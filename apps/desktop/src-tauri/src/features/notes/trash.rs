use super::io::{column, live_media_names, live_titles, next_position, parent_of, slots, NoteStore};
use super::media_names::{free_media_name, split_media_name};
use super::model::{first_free_name, EntryCounts, EntryType, EntryRef, TrashItem, Trashed, FOLDER_KIND, MEDIA_KIND};
use super::usage::stored_bytes;
use crate::entities::media::MediaKind;
use crate::shared::db::now_ms;
use crate::shared::error::Result;
use rusqlite::{params, params_from_iter, Connection, OptionalExtension};
use std::collections::{HashMap, HashSet};

const DAY_MS: i64 = 24 * 60 * 60 * 1000;

const FOLDER_TREE: &str = "
WITH RECURSIVE tree (id) AS (
    SELECT ?1 UNION SELECT live_folders.id FROM live_folders JOIN tree ON live_folders.parent_id = tree.id
) SELECT id FROM tree";

fn trash_items_sql() -> String {
    format!(
        "SELECT trash.id, trash.kind, trash.entry_id, trash.deleted_at,
            CASE trash.kind
                WHEN {FOLDER_KIND} THEN (SELECT name FROM folders WHERE id = trash.entry_id)
                WHEN {MEDIA_KIND} THEN (SELECT name FROM media WHERE id = trash.entry_id)
                ELSE (SELECT title FROM notes WHERE id = trash.entry_id) END AS name,
            (SELECT count(*) FROM notes WHERE trash_id = trash.id) AS notes,
            CASE trash.kind WHEN {MEDIA_KIND} THEN (SELECT mime FROM media WHERE id = trash.entry_id) END AS mime,
            {} AS bytes
        FROM trash ORDER BY trash.deleted_at DESC, trash.id DESC",
        stored_bytes("trash_id = trash.id")
    )
}

fn mark_trashed(conn: &Connection, table: &str, ids: &[i64], trash_id: i64) -> Result<()> {
    if !ids.is_empty() {
        let sql = format!("UPDATE {table} SET trash_id = {trash_id} WHERE id IN ({})", slots(ids.len()));
        conn.execute(&sql, params_from_iter(ids))?;
    }
    Ok(())
}

fn purge(conn: &Connection, trash_ids: &[i64]) -> Result<()> {
    if trash_ids.is_empty() {
        return Ok(());
    }
    let list = trash_ids.iter().map(i64::to_string).collect::<Vec<_>>().join(", ");
    let purged_folders = format!("SELECT id FROM folders WHERE trash_id IN ({list})");
    let kept = format!("(trash_id IS NULL OR trash_id NOT IN ({list}))");
    conn.execute_batch(&format!(
        "UPDATE notes SET folder_id = NULL WHERE folder_id IN ({purged_folders}) AND {kept};
         UPDATE media SET folder_id = NULL WHERE folder_id IN ({purged_folders}) AND {kept};
         UPDATE folders SET parent_id = NULL WHERE parent_id IN ({purged_folders}) AND {kept};
         DELETE FROM notes WHERE trash_id IN ({list});
         DELETE FROM media WHERE trash_id IN ({list});
         DELETE FROM folders WHERE trash_id IN ({list});
         DELETE FROM trash WHERE id IN ({list});"
    ))?;
    Ok(())
}

#[derive(Default)]
struct Contents {
    folders: Vec<i64>,
    notes: Vec<i64>,
    media: Vec<i64>,
}

fn live_contents(conn: &Connection, entry: EntryRef) -> Result<Contents> {
    match entry {
        EntryRef::Note(id) => Ok(Contents { notes: vec![id], ..Contents::default() }),
        EntryRef::Media(id) => Ok(Contents { media: vec![id], ..Contents::default() }),
        EntryRef::Folder(id) => {
            let folders = column::<i64>(conn, FOLDER_TREE, [id])?;
            let inside = |table: &str| {
                let sql = format!("SELECT id FROM {table} WHERE folder_id IN ({}) ORDER BY id", slots(folders.len()));
                column::<i64>(conn, &sql, params_from_iter(&folders))
            };
            Ok(Contents { notes: inside("live_notes")?, media: inside("live_media")?, folders })
        }
    }
}

fn is_live_folder(conn: &Connection, id: i64) -> Result<bool> {
    let sql = "SELECT 1 FROM live_folders WHERE id = ?1";
    Ok(conn.query_row(sql, [id], |_| Ok(())).optional()?.is_some())
}

fn free_restored_names(
    conn: &Connection,
    trash_id: i64,
    table: &str,
    column: &str,
    mut taken: Vec<String>,
    free: impl Fn(&str, &[String]) -> String,
) -> Result<()> {
    let restored: Vec<(i64, String)> = conn
        .prepare(&format!("SELECT id, {column} FROM {table} WHERE trash_id = ?1 ORDER BY id"))?
        .query_map([trash_id], |r| Ok((r.get(0)?, r.get(1)?)))?
        .collect::<rusqlite::Result<_>>()?;
    for (id, name) in restored {
        let name_free = free(&name, &taken);
        if name_free != name {
            conn.execute(&format!("UPDATE {table} SET {column} = ?1 WHERE id = ?2"), params![name_free, id])?;
        }
        taken.push(name_free);
    }
    Ok(())
}

fn restore_one(conn: &Connection, trash_id: i64) -> Result<Option<EntryRef>> {
    let Some(entry) = conn
        .query_row("SELECT kind, entry_id FROM trash WHERE id = ?1", [trash_id], |r| {
            EntryRef::from_row(r.get(0)?, r.get(1)?)
        })
        .optional()?
    else {
        return Ok(None);
    };
    let (table, parent_column, id) = (entry.table(), entry.parent_column(), entry.id());
    let parent_sql = format!("SELECT {parent_column} FROM {table} WHERE id = ?1");
    let parent: Option<i64> = conn.query_row(&parent_sql, [id], |r| r.get(0)).optional()?.flatten();
    if let Some(parent) = parent {
        if !is_live_folder(conn, parent)? {
            let detach_sql = format!("UPDATE {table} SET {parent_column} = NULL, position = ?1 WHERE id = ?2");
            conn.execute(&detach_sql, params![next_position(conn, None)?, id])?;
        }
    }
    free_restored_names(conn, trash_id, "notes", "title", live_titles(conn)?, |title, taken| {
        first_free_name(title, "", taken.iter().map(String::as_str))
    })?;
    free_restored_names(conn, trash_id, "media", "name", live_media_names(conn)?, |name, taken| {
        let (stem, extension) = split_media_name(name);
        free_media_name(stem, extension, taken.iter().map(String::as_str))
    })?;
    for table in ["notes", "folders", "media"] {
        conn.execute(&format!("UPDATE {table} SET trash_id = NULL WHERE trash_id = ?1"), [trash_id])?;
    }
    conn.execute("DELETE FROM trash WHERE id = ?1", [trash_id])?;
    Ok(Some(entry))
}

impl NoteStore {
    pub fn trash_entries(&self, entries: &[EntryRef]) -> Result<Trashed> {
        let mut store = self.db.lock();
        let tx = store.conn.transaction()?;
        let picked: HashSet<i64> = entries
            .iter()
            .filter_map(|entry| if let EntryRef::Folder(id) = *entry { Some(id) } else { None })
            .collect();
        let mut tops: Vec<EntryRef> = Vec::new();
        for &entry in entries {
            let mut ancestor = parent_of(&tx, entry)?;
            let mut inside_picked_folder = false;
            while let Some(id) = ancestor {
                inside_picked_folder |= picked.contains(&id);
                ancestor = parent_of(&tx, EntryRef::Folder(id))?;
            }
            if !inside_picked_folder && !tops.contains(&entry) {
                tops.push(entry);
            }
        }
        let deleted_at = now_ms();
        let mut trashed = Trashed::default();
        for top in tops {
            tx.execute(
                "INSERT INTO trash (deleted_at, kind, entry_id) VALUES (?1, ?2, ?3)",
                params![deleted_at, top.kind(), top.id()],
            )?;
            let trash_id = tx.last_insert_rowid();
            let Contents { folders, notes, media } = live_contents(&tx, top)?;
            mark_trashed(&tx, "folders", &folders, trash_id)?;
            mark_trashed(&tx, "notes", &notes, trash_id)?;
            mark_trashed(&tx, "media", &media, trash_id)?;
            trashed.trash_ids.push(trash_id);
            trashed.removed.extend(folders.into_iter().map(EntryRef::Folder));
            trashed.removed.extend(notes.into_iter().map(EntryRef::Note));
            trashed.removed.extend(media.into_iter().map(EntryRef::Media));
        }
        tx.commit()?;
        Ok(trashed)
    }

    pub fn restore_trash(&self, trash_ids: &[i64]) -> Result<Vec<EntryRef>> {
        let mut store = self.db.lock();
        let tx = store.conn.transaction()?;
        let mut restored = Vec::new();
        for &trash_id in trash_ids {
            restored.extend(restore_one(&tx, trash_id)?);
        }
        tx.commit()?;
        Ok(restored)
    }

    pub fn list_trash(&self) -> Result<Vec<TrashItem>> {
        let store = self.db.lock();
        let mut media_counts: HashMap<i64, EntryCounts> = HashMap::new();
        let mut stmt = store
            .conn
            .prepare("SELECT trash_id, mime, count(*) FROM media WHERE trash_id IS NOT NULL GROUP BY trash_id, mime")?;
        for row in stmt.query_map([], |r| Ok((r.get::<_, i64>(0)?, r.get::<_, &MediaKind>(1)?.media_type, r.get::<_, i64>(2)?)))? {
            let (trash_id, media_type, count) = row?;
            media_counts.entry(trash_id).or_default().add_media(media_type, count.unsigned_abs());
        }
        let mut stmt = store.conn.prepare(&trash_items_sql())?;
        let rows = stmt.query_map([], |r| {
            let id = r.get("id")?;
            let entry = EntryRef::from_row(r.get("kind")?, r.get("entry_id")?)?;
            let entry_type = match entry {
                EntryRef::Note(_) => EntryType::Note,
                EntryRef::Folder(_) => EntryType::Folder,
                EntryRef::Media(_) => r.get::<_, &MediaKind>("mime")?.media_type.into(),
            };
            let mut counts = media_counts.remove(&id).unwrap_or_default();
            counts.note = r.get::<_, i64>("notes")?.unsigned_abs();
            Ok(TrashItem {
                id,
                entry,
                entry_type,
                name: r.get::<_, Option<String>>("name")?.unwrap_or_default(),
                deleted_at: r.get("deleted_at")?,
                counts,
                bytes: r.get::<_, i64>("bytes")?.unsigned_abs(),
            })
        })?;
        Ok(rows.collect::<rusqlite::Result<_>>()?)
    }

    fn purge_with(&self, pick: impl FnOnce(&Connection) -> Result<Vec<i64>>) -> Result<()> {
        let mut store = self.db.lock();
        let tx = store.conn.transaction()?;
        let trash_ids = pick(&tx)?;
        purge(&tx, &trash_ids)?;
        tx.commit()?;
        Ok(())
    }

    pub fn delete_from_trash(&self, trash_ids: &[i64]) -> Result<()> {
        self.purge_with(|_| Ok(trash_ids.to_vec()))
    }

    pub fn empty_trash(&self) -> Result<()> {
        self.purge_with(|conn| column(conn, "SELECT id FROM trash", []))
    }

    pub fn purge_expired_trash(&self, retention_days: u32) -> Result<()> {
        if retention_days == 0 {
            return Ok(());
        }
        let cutoff = now_ms() - i64::from(retention_days) * DAY_MS;
        self.purge_with(|conn| column(conn, "SELECT id FROM trash WHERE deleted_at < ?1", [cutoff]))
    }
}

#[cfg(test)]
mod tests {
    use super::super::io::order;
    use super::super::model::{FOLDER, NOTE};
    use super::*;
    use crate::shared::error::Error;

    #[test]
    fn deleted_note_is_gone() {
        let store = NoteStore::open_in_memory().unwrap();
        let kept = store.create(None, None).unwrap();
        let deleted = store.create(None, None).unwrap();
        store.trash_entries(&[EntryRef::Note(deleted.id)]).unwrap();
        assert!(matches!(store.load(deleted.id), Err(Error::NotFound(NOTE, id)) if id == deleted.id));
        assert_eq!(order(&store), [EntryRef::Note(kept.id)]);
    }

    #[test]
    fn trashed_notes_restore_into_place() {
        let store = NoteStore::open_in_memory().unwrap();
        let folder = store.create_folder(None).unwrap().id;
        let note = store.create(Some(folder), None).unwrap().id;
        store.save(note, "kept text").unwrap();
        let trashed = store.trash_entries(&[EntryRef::Note(note)]).unwrap();
        assert!(store.list_trash().unwrap().iter().any(|item| item.entry == EntryRef::Note(note)));
        assert!(matches!(store.save(note, "lost"), Err(Error::NotFound(NOTE, _))));
        assert_eq!(store.restore_trash(&trashed.trash_ids).unwrap(), [EntryRef::Note(note)]);
        assert_eq!(store.load(note).unwrap().body, "kept text");
        assert_eq!(store.load(note).unwrap().parent_id, Some(folder));
        assert!(store.list_trash().unwrap().is_empty());
    }

    #[test]
    fn trashing_a_folder_trashes_its_contents_as_one_item() {
        let store = NoteStore::open_in_memory().unwrap();
        let folder = store.create_folder(None).unwrap().id;
        let [inside, also_picked] = [(); 2].map(|_| store.create(Some(folder), None).unwrap().id);
        let picked = [EntryRef::Folder(folder), EntryRef::Note(also_picked)];
        let trashed = store.trash_entries(&picked).unwrap();
        assert_eq!(trashed.trash_ids.len(), 1);
        let items = store.list_trash().unwrap();
        assert_eq!((items.len(), items[0].counts.note), (1, 2));
        store.restore_trash(&trashed.trash_ids).unwrap();
        assert_eq!(order(&store), [EntryRef::Folder(folder), EntryRef::Note(inside), EntryRef::Note(also_picked)]);
    }

    #[test]
    fn restoring_a_note_whose_folder_is_gone_moves_it_to_the_top_level() {
        let store = NoteStore::open_in_memory().unwrap();
        let folder = store.create_folder(None).unwrap().id;
        let note = store.create(Some(folder), None).unwrap().id;
        let note_trash = store.trash_entries(&[EntryRef::Note(note)]).unwrap().trash_ids;
        let folder_trash = store.trash_entries(&[EntryRef::Folder(folder)]).unwrap().trash_ids;
        store.delete_from_trash(&folder_trash).unwrap();
        store.restore_trash(&note_trash).unwrap();
        assert_eq!(store.load(note).unwrap().parent_id, None);
        assert_eq!(order(&store), [EntryRef::Note(note)]);
    }

    #[test]
    fn restoring_renames_a_note_whose_title_was_taken() {
        let store = NoteStore::open_in_memory().unwrap();
        let first = store.create(None, None).unwrap();
        let trashed = store.trash_entries(&[EntryRef::Note(first.id)]).unwrap();
        let second = store.create(None, None).unwrap();
        assert_eq!(second.title, first.title);
        store.restore_trash(&trashed.trash_ids).unwrap();
        assert_eq!(store.load(first.id).unwrap().title, format!("{} 1", first.title));
    }

    #[test]
    fn emptying_and_expiring_the_trash_deletes_for_good() {
        let store = NoteStore::open_in_memory().unwrap();
        let [old, recent] = [(); 2].map(|_| store.create(None, None).unwrap().id);
        let old_trash = store.trash_entries(&[EntryRef::Note(old)]).unwrap().trash_ids;
        store.trash_entries(&[EntryRef::Note(recent)]).unwrap();
        store.db.lock().conn.execute("UPDATE trash SET deleted_at = 0 WHERE id = ?1", [old_trash[0]]).unwrap();
        store.purge_expired_trash(0).unwrap();
        assert_eq!(store.list_trash().unwrap().len(), 2);
        store.purge_expired_trash(30).unwrap();
        assert_eq!(store.list_trash().unwrap().len(), 1);
        assert!(store.restore_trash(&old_trash).unwrap().is_empty());
        assert!(store.usage().unwrap().trash_bytes > 0);
        store.empty_trash().unwrap();
        assert!(store.list_trash().unwrap().is_empty());
        assert_eq!(store.usage().unwrap().trash_bytes, 0);
    }

    #[test]
    fn live_views_hide_trashed_rows() {
        let store = NoteStore::open_in_memory().unwrap();
        let folder = store.create_folder(None).unwrap().id;
        let [inside, kept] = [Some(folder), None].map(|parent| store.create(parent, None).unwrap().id);
        let trashed = store.trash_entries(&[EntryRef::Folder(folder)]).unwrap();
        let ids = |sql: &str| column::<i64>(&store.db.lock().conn, sql, []).unwrap();
        assert_eq!(ids("SELECT id FROM live_notes"), [kept]);
        assert!(ids("SELECT id FROM live_folders").is_empty());
        assert_eq!(ids("SELECT id FROM notes ORDER BY id"), [inside, kept]);
        assert_eq!(ids("SELECT id FROM folders"), [folder]);
        store.restore_trash(&trashed.trash_ids).unwrap();
        assert_eq!(ids("SELECT id FROM live_notes ORDER BY id"), [inside, kept]);
        assert_eq!(ids("SELECT id FROM live_folders"), [folder]);
    }

    #[test]
    fn trashed_folders_reject_writes() {
        let store = NoteStore::open_in_memory().unwrap();
        let folder = store.create_folder(None).unwrap().id;
        store.trash_entries(&[EntryRef::Folder(folder)]).unwrap();
        assert!(matches!(store.rename_folder(folder, "x"), Err(Error::NotFound(FOLDER, _))));
        assert!(matches!(store.set_folder_collapsed(folder, true), Err(Error::NotFound(FOLDER, _))));
        assert!(matches!(store.create(Some(folder), None), Err(Error::NotFound(FOLDER, _))));
        store.set_all_folders_collapsed(true).unwrap();
        let sql = "SELECT collapsed FROM folders WHERE id = ?1";
        let collapsed: bool = store.db.lock().conn.query_row(sql, [folder], |r| r.get(0)).unwrap();
        assert!(!collapsed);
    }

    #[test]
    fn deleting_missing_note_is_not_found() {
        let store = NoteStore::open_in_memory().unwrap();
        assert!(matches!(store.trash_entries(&[EntryRef::Note(42)]), Err(Error::NotFound(NOTE, 42))));
    }

    #[test]
    fn deleting_folder_removes_its_contents_and_returns_their_notes() {
        let store = NoteStore::open_in_memory().unwrap();
        let outer = store.create_folder(None).unwrap().id;
        let inner = store.create_folder(None).unwrap().id;
        let [kept, top, nested] = [(); 3].map(|_| store.create(None, None).unwrap().id);
        store.move_entries(&[EntryRef::Folder(inner)], Some(outer), 0).unwrap();
        store.move_entries(&[EntryRef::Note(top)], Some(outer), 0).unwrap();
        store.move_entries(&[EntryRef::Note(nested)], Some(inner), 0).unwrap();
        assert_eq!(
            store.trash_entries(&[EntryRef::Folder(outer)]).unwrap().removed,
            [EntryRef::Folder(outer), EntryRef::Folder(inner), EntryRef::Note(top), EntryRef::Note(nested)]
        );
        assert_eq!(order(&store), [EntryRef::Note(kept)]);
        assert!(matches!(store.load(nested), Err(Error::NotFound(NOTE, _))));
    }

    #[test]
    fn deleting_missing_folder_is_not_found() {
        let store = NoteStore::open_in_memory().unwrap();
        assert!(matches!(store.trash_entries(&[EntryRef::Folder(42)]), Err(Error::NotFound(FOLDER, 42))));
    }

    #[test]
    fn deleting_several_entries_tolerates_overlap() {
        let store = NoteStore::open_in_memory().unwrap();
        let folder = store.create_folder(None).unwrap().id;
        let [inside, loose, kept] = [(); 3].map(|_| store.create(None, None).unwrap().id);
        store.move_entries(&[EntryRef::Note(inside)], Some(folder), 0).unwrap();
        let doomed = [EntryRef::Folder(folder), EntryRef::Note(inside), EntryRef::Note(loose)];
        assert_eq!(
            store.trash_entries(&doomed).unwrap().removed,
            [EntryRef::Folder(folder), EntryRef::Note(inside), EntryRef::Note(loose)]
        );
        assert_eq!(order(&store), [EntryRef::Note(kept)]);
    }

    #[test]
    fn deleting_missing_entry_deletes_nothing() {
        let store = NoteStore::open_in_memory().unwrap();
        let note = EntryRef::Note(store.create(None, None).unwrap().id);
        assert!(matches!(store.trash_entries(&[note, EntryRef::Note(42)]), Err(Error::NotFound(NOTE, 42))));
        assert_eq!(order(&store), [note]);
    }
}
