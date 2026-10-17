use super::compression::{Codec, CURRENT_DICTIONARY, MAX_NOTE_BYTES, MAX_NOTE_MB};
use super::media_names::{free_media_name, split_media_name};
use super::model::{
    copy_title, corrupt_note, first_free_name, title_key, Entry, EntryRef, Folder, MediaSummary, Note,
    NoteFormat, NoteSummary, FOLDER, FOLDER_KIND, MEDIA, MEDIA_KIND, NOTE, NOTE_KIND, UNTITLED_FOLDER,
};
#[cfg(test)]
use super::schema::MIGRATIONS;
use crate::shared::db::now_ms;
use crate::shared::error::{Error, Result};
use crate::shared::lock::Lock;
use rusqlite::types::FromSql;
use rusqlite::{params, Connection, OptionalExtension};

const FOLDER_INTO_ITSELF: &str = "A folder can't be moved into itself.";

fn note_format(conn: &Connection, id: i64) -> Result<NoteFormat> {
    conn.query_row("SELECT format FROM live_notes WHERE id = ?1", [id], |r| r.get(0))
        .optional()?
        .ok_or(Error::NotFound(NOTE, id))
}

fn entries() -> String {
    format!(
        "SELECT {NOTE_KIND} AS kind, position, id, title AS name, folder_id AS parent_id, 0 AS collapsed, NULL AS mime, 0 AS bytes, format FROM live_notes
        UNION ALL SELECT {FOLDER_KIND}, position, id, name, parent_id, collapsed, NULL, 0, 'markdown' FROM live_folders
        UNION ALL SELECT {MEDIA_KIND}, position, id, name, folder_id, 0, mime, length(data), 'markdown' FROM live_media"
    )
}

fn entry_order() -> String {
    format!("ORDER BY kind = {FOLDER_KIND} DESC, position, id")
}

pub(super) struct Store {
    pub(super) conn: Connection,
    pub(super) codec: Codec,
}

pub struct NoteStore {
    pub(super) db: Lock<Store>,
}

pub(super) fn column<T: FromSql>(conn: &Connection, sql: &str, params: impl rusqlite::Params) -> Result<Vec<T>> {
    let mut stmt = conn.prepare(sql)?;
    let rows = stmt.query_map(params, |r| r.get(0))?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

pub(super) fn live_titles(conn: &Connection) -> Result<Vec<String>> {
    column(conn, "SELECT title FROM live_notes", [])
}

pub(super) fn live_media_names(conn: &Connection) -> Result<Vec<String>> {
    column(conn, "SELECT name FROM live_media", [])
}

pub(super) fn slots(count: usize) -> String {
    vec!["?"; count].join(", ")
}

pub(super) fn next_position(conn: &Connection, parent: Option<i64>) -> Result<i64> {
    let sql = format!("SELECT COALESCE(MAX(position) + 1, 0) FROM ({}) WHERE parent_id IS ?1", entries());
    Ok(conn.query_row(&sql, [parent], |r| r.get(0))?)
}

fn siblings(conn: &Connection, parent: Option<i64>) -> Result<Vec<EntryRef>> {
    let mut stmt = conn.prepare(&format!("SELECT kind, id FROM ({}) WHERE parent_id IS ?1 {}", entries(), entry_order()))?;
    let rows = stmt.query_map([parent], |r| EntryRef::from_row(r.get("kind")?, r.get("id")?))?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

pub(super) fn refuse_taken_name(conn: &Connection, others: &str, id: i64, item: &str, name: &str) -> Result<()> {
    let taken = column::<String>(conn, others, [id])?;
    if taken.iter().any(|other| title_key(other) == title_key(name)) {
        return Err(Error::Message(format!("There's already a {} named “{name}”.", item.to_lowercase())));
    }
    Ok(())
}

fn not_found(entry: EntryRef) -> Error {
    match entry {
        EntryRef::Note(id) => Error::NotFound(NOTE, id),
        EntryRef::Folder(id) => Error::NotFound(FOLDER, id),
        EntryRef::Media(id) => Error::NotFound(MEDIA, id),
    }
}

pub(super) fn parent_of(conn: &Connection, entry: EntryRef) -> Result<Option<i64>> {
    let sql = format!("SELECT {} FROM {} WHERE id = ?1", entry.parent_column(), entry.live_table());
    conn.query_row(&sql, [entry.id()], |r| r.get(0)).optional()?.ok_or(not_found(entry))
}

struct TakenNames {
    titles: Vec<String>,
    media: Vec<String>,
}

fn copy_entry(conn: &Connection, entry: EntryRef, parent: Option<i64>, taken: &mut TakenNames) -> Result<EntryRef> {
    match entry {
        EntryRef::Note(id) => {
            let title: String = conn.query_row("SELECT title FROM notes WHERE id = ?1", [id], |r| r.get(0))?;
            let title = first_free_name(&copy_title(&title), "", taken.titles.iter().map(String::as_str));
            conn.execute(
                "INSERT INTO notes (title, body, dict_id, created_at, updated_at, folder_id, position, format)
                 SELECT ?1, body, dict_id, ?2, ?2, ?3, ?4, format FROM notes WHERE id = ?5",
                params![title, now_ms(), parent, next_position(conn, parent)?, id],
            )?;
            taken.titles.push(title);
            Ok(EntryRef::Note(conn.last_insert_rowid()))
        }
        EntryRef::Folder(id) => {
            conn.execute(
                "INSERT INTO folders (name, parent_id, position, collapsed) SELECT name, ?1, ?2, collapsed FROM folders WHERE id = ?3",
                params![parent, next_position(conn, parent)?, id],
            )?;
            let copy = conn.last_insert_rowid();
            for child in siblings(conn, Some(id))? {
                copy_entry(conn, child, Some(copy), taken)?;
            }
            Ok(EntryRef::Folder(copy))
        }
        EntryRef::Media(id) => {
            let name: String = conn.query_row("SELECT name FROM media WHERE id = ?1", [id], |r| r.get(0))?;
            let (stem, extension) = split_media_name(&name);
            let name = free_media_name(&copy_title(stem), extension, taken.media.iter().map(String::as_str));
            conn.execute(
                "INSERT INTO media (name, created_at, folder_id, position, mime, data)
                 SELECT ?1, ?2, ?3, ?4, mime, data FROM media WHERE id = ?5",
                params![name, now_ms(), parent, next_position(conn, parent)?, id],
            )?;
            taken.media.push(name);
            Ok(EntryRef::Media(conn.last_insert_rowid()))
        }
    }
}

fn place(conn: &Connection, moved: &[EntryRef], parent: Option<i64>, index: usize) -> Result<()> {
    let mut order = siblings(conn, parent)?;
    order.retain(|sibling| !moved.contains(sibling));
    let at = index.min(order.len());
    order.splice(at..at, moved.iter().copied());
    order.sort_by_key(|sibling| !sibling.is_folder());
    for (position, &sibling) in (0i64..).zip(&order) {
        let (table, live, parent_column) = (sibling.table(), sibling.live_table(), sibling.parent_column());
        let sql = format!(
            "UPDATE {table} SET {parent_column} = ?1, position = ?2 WHERE id IN (SELECT id FROM {live} WHERE id = ?3)"
        );
        if conn.execute(&sql, params![parent, position, sibling.id()])? == 0 {
            return Err(not_found(sibling));
        }
    }
    Ok(())
}

impl NoteStore {
    pub fn new(conn: Connection) -> Result<Self> {
        Ok(Self { db: Lock::new(Store { conn, codec: Codec::new()? }) })
    }

    #[cfg(test)]
    pub(super) fn open_in_memory() -> Result<Self> {
        Self::new(crate::shared::db::open_in_memory(MIGRATIONS)?)
    }

    pub fn create(&self, parent: Option<i64>, title: Option<&str>) -> Result<NoteSummary> {
        self.create_as(parent, title, NoteFormat::Markdown)
    }

    pub fn create_as(&self, parent: Option<i64>, title: Option<&str>, format: NoteFormat) -> Result<NoteSummary> {
        let mut store = self.db.lock();
        if let Some(id) = parent {
            parent_of(&store.conn, EntryRef::Folder(id))?;
        }
        let base = title.map(str::trim).filter(|title| !title.is_empty()).unwrap_or(format.untitled());
        let title = first_free_name(base, "", live_titles(&store.conn)?.iter().map(String::as_str));
        let body = store.codec.compress(&format.empty_body())?;
        let position = next_position(&store.conn, parent)?;
        store.conn.execute(
            "INSERT INTO notes (title, body, dict_id, created_at, updated_at, folder_id, position, format)
             VALUES (?1, ?2, ?3, ?4, ?4, ?5, ?6, ?7)",
            params![title, body, CURRENT_DICTIONARY, now_ms(), parent, position, format.as_str()],
        )?;
        Ok(NoteSummary { id: store.conn.last_insert_rowid(), title, parent_id: parent, format })
    }

    pub fn create_folder(&self, parent: Option<i64>) -> Result<Folder> {
        let store = self.db.lock();
        if let Some(id) = parent {
            parent_of(&store.conn, EntryRef::Folder(id))?;
        }
        let untitled = column::<String>(
            &store.conn,
            "SELECT name FROM live_folders WHERE name LIKE ?1",
            [format!("{UNTITLED_FOLDER}%")],
        )?;
        let name = first_free_name(UNTITLED_FOLDER, "", untitled.iter().map(String::as_str));
        store.conn.execute(
            "INSERT INTO folders (name, parent_id, position) VALUES (?1, ?2, ?3)",
            params![name, parent, next_position(&store.conn, parent)?],
        )?;
        Ok(Folder { id: store.conn.last_insert_rowid(), name, parent_id: parent, collapsed: false })
    }

    pub fn list(&self) -> Result<Vec<Entry>> {
        let store = self.db.lock();
        let mut stmt = store.conn.prepare(&format!("SELECT * FROM ({}) {}", entries(), entry_order()))?;
        let rows = stmt.query_map([], |r| {
            let (id, name, parent_id) = (r.get("id")?, r.get("name")?, r.get("parent_id")?);
            Ok(match EntryRef::from_row(r.get("kind")?, id)? {
                EntryRef::Folder(_) => Entry::Folder(Folder { id, name, parent_id, collapsed: r.get("collapsed")? }),
                EntryRef::Media(_) => {
                    let bytes = u64::try_from(r.get::<_, i64>("bytes")?).unwrap_or(0);
                    Entry::Media(MediaSummary::new(id, name, parent_id, r.get("mime")?, bytes))
                }
                EntryRef::Note(_) => Entry::Note(NoteSummary { id, title: name, parent_id, format: r.get("format")? }),
            })
        })?;
        Ok(rows.collect::<rusqlite::Result<_>>()?)
    }

    pub fn load(&self, id: i64) -> Result<Note> {
        let mut store = self.db.lock();
        let (title, parent_id, body, dict_id, format): (String, Option<i64>, Vec<u8>, u32, NoteFormat) = store
            .conn
            .query_row("SELECT title, folder_id, body, dict_id, format FROM live_notes WHERE id = ?1", [id], |r| {
                Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?))
            })
            .optional()?
            .ok_or(Error::NotFound(NOTE, id))?;
        let body = store.codec.decompress(dict_id, &body).map_err(|e| corrupt_note(id, &e))?;
        Ok(Note { id, title, parent_id, body, format })
    }

    pub fn format(&self, id: i64) -> Result<NoteFormat> {
        note_format(&self.db.lock().conn, id)
    }

    pub fn save(&self, id: i64, text: &str) -> Result<()> {
        if text.len() as u64 > MAX_NOTE_BYTES {
            return Err(Error::Message(format!("This note is larger than the {MAX_NOTE_MB} MB limit.")));
        }
        let mut store = self.db.lock();
        if note_format(&store.conn, id)? == NoteFormat::Excalidraw {
            super::excalidraw::validate_scene(text)?;
        }
        let body = store.codec.compress(text)?;
        let changed = store.conn.execute(
            "UPDATE notes SET body = ?1, dict_id = ?2, updated_at = ?3
             WHERE id IN (SELECT id FROM live_notes WHERE id = ?4)",
            params![body, CURRENT_DICTIONARY, now_ms(), id],
        )?;
        if changed == 0 {
            return Err(Error::NotFound(NOTE, id));
        }
        Ok(())
    }

    pub fn rename(&self, id: i64, title: &str) -> Result<Option<String>> {
        let store = self.db.lock();
        let current: String = store
            .conn
            .query_row("SELECT title FROM live_notes WHERE id = ?1", [id], |r| r.get(0))
            .optional()?
            .ok_or(Error::NotFound(NOTE, id))?;
        let title = title.trim();
        if title.is_empty() {
            return Ok(None);
        }
        if title == current {
            return Ok(Some(current));
        }
        refuse_taken_name(&store.conn, "SELECT title FROM live_notes WHERE id != ?1", id, NOTE, title)?;
        store.conn.execute(
            "UPDATE notes SET title = ?1, updated_at = ?2 WHERE id = ?3",
            params![title, now_ms(), id],
        )?;
        Ok(Some(title.to_string()))
    }

    pub fn duplicate_entry(&self, entry: EntryRef) -> Result<EntryRef> {
        let mut store = self.db.lock();
        let tx = store.conn.transaction()?;
        let parent = parent_of(&tx, entry)?;
        let after = siblings(&tx, parent)?.iter().position(|&sibling| sibling == entry);
        let mut taken = TakenNames { titles: live_titles(&tx)?, media: live_media_names(&tx)? };
        let copy = copy_entry(&tx, entry, parent, &mut taken)?;
        if let EntryRef::Folder(id) = copy {
            let name: String = tx.query_row("SELECT name FROM folders WHERE id = ?1", [id], |r| r.get(0))?;
            let names: Vec<String> = column(&tx, "SELECT name FROM live_folders", [])?;
            let name = first_free_name(&copy_title(&name), "", names.iter().map(String::as_str));
            tx.execute("UPDATE folders SET name = ?1 WHERE id = ?2", params![name, id])?;
        }
        place(&tx, &[copy], parent, after.map_or(usize::MAX, |index| index + 1))?;
        tx.commit()?;
        Ok(copy)
    }

    pub fn rename_folder(&self, id: i64, name: &str) -> Result<Option<String>> {
        let store = self.db.lock();
        parent_of(&store.conn, EntryRef::Folder(id))?;
        let name = name.trim();
        if name.is_empty() {
            return Ok(None);
        }
        refuse_taken_name(&store.conn, "SELECT name FROM live_folders WHERE id != ?1", id, FOLDER, name)?;
        store.conn.execute("UPDATE folders SET name = ?1 WHERE id = ?2", params![name, id])?;
        Ok(Some(name.to_owned()))
    }

    pub fn set_folder_collapsed(&self, id: i64, collapsed: bool) -> Result<()> {
        let sql = "UPDATE folders SET collapsed = ?1 WHERE id IN (SELECT id FROM live_folders WHERE id = ?2)";
        let changed = self.db.lock().conn.execute(sql, params![collapsed, id])?;
        if changed == 0 {
            return Err(Error::NotFound(FOLDER, id));
        }
        Ok(())
    }

    pub fn set_all_folders_collapsed(&self, collapsed: bool) -> Result<()> {
        let sql = "UPDATE folders SET collapsed = ?1 WHERE id IN (SELECT id FROM live_folders)";
        self.db.lock().conn.execute(sql, [collapsed])?;
        Ok(())
    }

    pub fn move_entries(&self, entries: &[EntryRef], parent: Option<i64>, index: usize) -> Result<()> {
        let mut store = self.db.lock();
        let tx = store.conn.transaction()?;
        let mut ancestor = parent;
        while let Some(id) = ancestor {
            if entries.contains(&EntryRef::Folder(id)) {
                return Err(Error::Message(FOLDER_INTO_ITSELF.into()));
            }
            ancestor = parent_of(&tx, EntryRef::Folder(id))?;
        }
        place(&tx, entries, parent, index)?;
        tx.commit()?;
        Ok(())
    }

    #[cfg(test)]
    fn stored_dictionary(&self, id: i64) -> u32 {
        self.db.lock().conn.query_row("SELECT dict_id FROM notes WHERE id = ?1", [id], |r| r.get(0)).unwrap()
    }

    #[cfg(test)]
    fn corrupt_body(&self, id: i64) {
        self.db.lock().conn.execute("UPDATE notes SET body = x'00' WHERE id = ?1", [id]).unwrap();
    }
}

#[cfg(test)]
pub(super) fn order(store: &NoteStore) -> Vec<EntryRef> {
    let entry_ref = |entry: Entry| match entry {
        Entry::Note(note) => EntryRef::Note(note.id),
        Entry::Folder(folder) => EntryRef::Folder(folder.id),
        Entry::Media(media) => EntryRef::Media(media.id),
    };
    store.list().unwrap().into_iter().map(entry_ref).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn children(store: &NoteStore, parent: Option<i64>) -> Vec<EntryRef> {
        siblings(&store.db.lock().conn, parent).unwrap()
    }

    fn copied_note(store: &NoteStore, id: i64) -> Note {
        let EntryRef::Note(copy) = store.duplicate_entry(EntryRef::Note(id)).unwrap() else { panic!("expected a note") };
        store.load(copy).unwrap()
    }

    #[test]
    fn notes_over_the_size_limit_are_not_saved() {
        let store = NoteStore::open_in_memory().unwrap();
        let note = store.create(None, None).unwrap();
        let huge = "a".repeat(MAX_NOTE_BYTES as usize + 1);
        assert!(store.save(note.id, &huge).is_err());
        assert_eq!(store.load(note.id).unwrap().body, "");
    }

    #[test]
    fn new_notes_get_untitled_names() {
        let store = NoteStore::open_in_memory().unwrap();
        let titles: Vec<String> = (0..3).map(|_| store.create(None, None).unwrap().title).collect();
        assert_eq!(titles, ["Untitled note", "Untitled note 1", "Untitled note 2"]);
    }

    #[test]
    fn notes_can_start_with_a_title() {
        let store = NoteStore::open_in_memory().unwrap();
        assert_eq!(store.create(None, Some(" Groceries ")).unwrap().title, "Groceries");
        assert_eq!(store.create(None, Some("groceries")).unwrap().title, "groceries 1");
        assert_eq!(store.create(None, Some("  ")).unwrap().title, "Untitled note");
    }

    #[test]
    fn new_note_reuses_freed_untitled_number() {
        let store = NoteStore::open_in_memory().unwrap();
        store.create(None, None).unwrap();
        let first = store.create(None, None).unwrap();
        store.create(None, None).unwrap();
        store.rename(first.id, "Groceries").unwrap();
        assert_eq!(store.create(None, None).unwrap().title, "Untitled note 1");
    }

    #[test]
    fn rename_trims_and_saves_title() {
        let store = NoteStore::open_in_memory().unwrap();
        let note = store.create(None, None).unwrap();
        assert_eq!(store.rename(note.id, "  Groceries ").unwrap().as_deref(), Some("Groceries"));
        assert_eq!(store.load(note.id).unwrap().title, "Groceries");
    }

    #[test]
    fn rename_to_empty_is_rejected() {
        let store = NoteStore::open_in_memory().unwrap();
        let note = store.create(None, None).unwrap();
        assert_eq!(store.rename(note.id, "   ").unwrap(), None);
        assert_eq!(store.load(note.id).unwrap().title, note.title);
    }

    #[test]
    fn rename_to_taken_title_is_rejected() {
        let store = NoteStore::open_in_memory().unwrap();
        let groceries = store.create(None, None).unwrap();
        store.rename(groceries.id, "Groceries").unwrap();
        let other = store.create(None, None).unwrap();
        let refused = store.rename(other.id, "groceries").unwrap_err();
        assert_eq!(refused.to_string(), "There's already a note named “groceries”.");
        assert_eq!(store.load(other.id).unwrap().title, other.title);
    }

    #[test]
    fn rename_to_own_title_is_kept() {
        let store = NoteStore::open_in_memory().unwrap();
        let note = store.create(None, None).unwrap();
        assert_eq!(store.rename(note.id, &note.title).unwrap(), Some(note.title));
    }

    #[test]
    fn renaming_missing_note_is_not_found() {
        let store = NoteStore::open_in_memory().unwrap();
        assert!(matches!(store.rename(42, "x"), Err(Error::NotFound(NOTE, 42))));
    }

    #[test]
    fn duplicate_copies_body_under_free_title() {
        let store = NoteStore::open_in_memory().unwrap();
        let note = store.create(None, None).unwrap();
        store.rename(note.id, "Groceries").unwrap();
        store.save(note.id, "- eggs").unwrap();
        let first = copied_note(&store, note.id);
        let second = copied_note(&store, note.id);
        assert_eq!((first.title.as_str(), second.title.as_str()), ("Groceries copy", "Groceries copy 1"));
        assert_eq!(second.body, "- eggs");
    }

    #[test]
    fn duplicating_missing_note_is_not_found() {
        let store = NoteStore::open_in_memory().unwrap();
        assert!(matches!(store.duplicate_entry(EntryRef::Note(42)), Err(Error::NotFound(NOTE, 42))));
    }

    #[test]
    fn list_returns_every_note() {
        let store = NoteStore::open_in_memory().unwrap();
        let ids: Vec<i64> = (0..3).map(|_| store.create(None, None).unwrap().id).collect();
        assert_eq!(order(&store), ids.into_iter().map(EntryRef::Note).collect::<Vec<_>>());
    }

    #[test]
    fn save_then_load_returns_same_text() {
        let store = NoteStore::open_in_memory().unwrap();
        let note = store.create(None, None).unwrap();
        let text = "Groceries\n- eggs\n- coffee\n";
        store.save(note.id, text).unwrap();
        assert_eq!(store.load(note.id).unwrap().body, text);
    }

    #[test]
    fn saved_note_records_current_dictionary() {
        let store = NoteStore::open_in_memory().unwrap();
        let note = store.create(None, None).unwrap();
        store.save(note.id, "hello").unwrap();
        assert_eq!(store.stored_dictionary(note.id), CURRENT_DICTIONARY);
    }

    #[test]
    fn loading_missing_note_is_not_found() {
        let store = NoteStore::open_in_memory().unwrap();
        assert!(matches!(store.load(42), Err(Error::NotFound(NOTE, 42))));
    }

    #[test]
    fn saving_missing_note_is_not_found() {
        let store = NoteStore::open_in_memory().unwrap();
        assert!(matches!(store.save(42, "x"), Err(Error::NotFound(NOTE, 42))));
    }

    #[test]
    fn corrupt_body_names_the_note() {
        let store = NoteStore::open_in_memory().unwrap();
        let note = store.create(None, None).unwrap();
        store.corrupt_body(note.id);
        let error = store.load(note.id).unwrap_err().to_string();
        assert!(error.starts_with(&format!("Note {} couldn't be decoded", note.id)), "{error}");
    }

    #[test]
    fn reopening_keeps_schema() {
        let dir = crate::shared::testing::temp_dir("notes-reopen");
        let path = dir.join(crate::shared::db::DATABASE_FILE);
        let open = || NoteStore::new(crate::shared::db::open(&path, MIGRATIONS).unwrap()).unwrap();
        let id = open().create(None, None).unwrap().id;
        assert!(open().load(id).is_ok());
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn new_entries_go_to_the_bottom_and_renames_keep_order() {
        let store = NoteStore::open_in_memory().unwrap();
        let first = store.create(None, None).unwrap().id;
        let folder = store.create_folder(None).unwrap().id;
        let last = store.create(None, None).unwrap().id;
        store.rename(last, "Aardvark").unwrap();
        store.save(first, "edited").unwrap();
        assert_eq!(order(&store), [EntryRef::Folder(folder), EntryRef::Note(first), EntryRef::Note(last)]);
    }

    #[test]
    fn new_folders_get_untitled_names() {
        let store = NoteStore::open_in_memory().unwrap();
        let names: Vec<String> = (0..2).map(|_| store.create_folder(None).unwrap().name).collect();
        assert_eq!(names, ["Untitled folder", "Untitled folder 1"]);
    }

    #[test]
    fn rename_folder_trims_and_saves_name() {
        let store = NoteStore::open_in_memory().unwrap();
        let folder = store.create_folder(None).unwrap();
        assert_eq!(store.rename_folder(folder.id, " Work ").unwrap().as_deref(), Some("Work"));
        assert!(matches!(store.list().unwrap()[0], Entry::Folder(ref f) if f.name == "Work"));
    }

    #[test]
    fn rename_folder_to_empty_or_taken_name_is_rejected() {
        let store = NoteStore::open_in_memory().unwrap();
        let work = store.create_folder(None).unwrap();
        store.rename_folder(work.id, "Work").unwrap();
        let other = store.create_folder(None).unwrap();
        assert_eq!(store.rename_folder(other.id, "  ").unwrap(), None);
        let refused = store.rename_folder(other.id, "work").unwrap_err();
        assert_eq!(refused.to_string(), "There's already a folder named “work”.");
        assert_eq!(store.rename_folder(work.id, "Work").unwrap().as_deref(), Some("Work"));
    }

    #[test]
    fn renaming_missing_folder_is_not_found() {
        let store = NoteStore::open_in_memory().unwrap();
        assert!(matches!(store.rename_folder(42, "x"), Err(Error::NotFound(FOLDER, 42))));
    }

    #[test]
    fn collapsed_state_is_saved() {
        let store = NoteStore::open_in_memory().unwrap();
        let folder = store.create_folder(None).unwrap();
        store.set_folder_collapsed(folder.id, true).unwrap();
        assert!(matches!(store.list().unwrap()[0], Entry::Folder(ref f) if f.collapsed));
    }

    #[test]
    fn move_reorders_siblings() {
        let store = NoteStore::open_in_memory().unwrap();
        let [a, b, c] = [(); 3].map(|_| EntryRef::Note(store.create(None, None).unwrap().id));
        store.move_entries(&[c], None, 0).unwrap();
        assert_eq!(children(&store, None), [c, a, b]);
        store.move_entries(&[c], None, 99).unwrap();
        assert_eq!(children(&store, None), [a, b, c]);
    }

    #[test]
    fn move_puts_notes_and_folders_into_folders() {
        let store = NoteStore::open_in_memory().unwrap();
        let outer = store.create_folder(None).unwrap().id;
        let inner = EntryRef::Folder(store.create_folder(None).unwrap().id);
        let [a, b] = [(); 2].map(|_| EntryRef::Note(store.create(None, None).unwrap().id));
        store.move_entries(&[inner], Some(outer), 0).unwrap();
        store.move_entries(&[b], Some(outer), 0).unwrap();
        store.move_entries(&[a], Some(outer), 2).unwrap();
        assert_eq!(children(&store, None), [EntryRef::Folder(outer)]);
        assert_eq!(children(&store, Some(outer)), [inner, b, a]);
    }

    #[test]
    fn move_out_of_folder_returns_to_root() {
        let store = NoteStore::open_in_memory().unwrap();
        let folder = store.create_folder(None).unwrap().id;
        let note = EntryRef::Note(store.create(None, None).unwrap().id);
        store.move_entries(&[note], Some(folder), 0).unwrap();
        store.move_entries(&[note], None, 0).unwrap();
        assert_eq!(children(&store, None), [EntryRef::Folder(folder), note]);
        assert!(children(&store, Some(folder)).is_empty());
    }

    #[test]
    fn folder_cannot_move_into_itself_or_descendant() {
        let store = NoteStore::open_in_memory().unwrap();
        let outer = store.create_folder(None).unwrap().id;
        let inner = store.create_folder(None).unwrap().id;
        store.move_entries(&[EntryRef::Folder(inner)], Some(outer), 0).unwrap();
        let into = |parent| store.move_entries(&[EntryRef::Folder(outer)], Some(parent), 0).unwrap_err().to_string();
        assert_eq!((into(outer), into(inner)), (FOLDER_INTO_ITSELF.to_owned(), FOLDER_INTO_ITSELF.to_owned()));
        assert_eq!(children(&store, Some(outer)), [EntryRef::Folder(inner)]);
    }

    #[test]
    fn moving_into_missing_folder_is_not_found() {
        let store = NoteStore::open_in_memory().unwrap();
        let note = EntryRef::Note(store.create(None, None).unwrap().id);
        assert!(matches!(store.move_entries(&[note], Some(42), 0), Err(Error::NotFound(FOLDER, 42))));
    }

    #[test]
    fn moving_missing_note_is_not_found() {
        let store = NoteStore::open_in_memory().unwrap();
        assert!(matches!(store.move_entries(&[EntryRef::Note(42)], None, 0), Err(Error::NotFound(NOTE, 42))));
    }

    #[test]
    fn adding_folders_keeps_existing_notes_in_title_order() {
        let conn = crate::shared::db::open_in_memory(&MIGRATIONS[..1]).unwrap();
        for title in ["beta", "Alpha", "gamma"] {
            let sql = "INSERT INTO notes (title, body, dict_id, created_at, updated_at) VALUES (?1, x'', 1, 0, 0)";
            conn.execute(sql, [title]).unwrap();
        }
        crate::shared::db::migrate(&conn, MIGRATIONS).unwrap();
        let store = NoteStore::new(conn).unwrap();
        let titles: Vec<String> = store
            .list()
            .unwrap()
            .into_iter()
            .filter_map(|entry| match entry {
                Entry::Note(note) => Some(note.title),
                Entry::Folder(_) | Entry::Media(_) => None,
            })
            .collect();
        assert_eq!(titles, ["Alpha", "beta", "gamma"]);
    }

    #[test]
    fn duplicate_goes_right_after_the_original_in_its_folder() {
        let store = NoteStore::open_in_memory().unwrap();
        let folder = store.create_folder(None).unwrap().id;
        let [a, b] = [(); 2].map(|_| store.create(None, None).unwrap().id);
        store.move_entries(&[EntryRef::Note(a)], Some(folder), 0).unwrap();
        store.move_entries(&[EntryRef::Note(b)], Some(folder), 1).unwrap();
        let copy = copied_note(&store, a);
        assert_eq!(copy.parent_id, Some(folder));
        assert_eq!(children(&store, Some(folder)), [EntryRef::Note(a), EntryRef::Note(copy.id), EntryRef::Note(b)]);
    }

    #[test]
    fn load_returns_folder() {
        let store = NoteStore::open_in_memory().unwrap();
        let folder = store.create_folder(None).unwrap().id;
        let note = store.create(None, None).unwrap().id;
        store.move_entries(&[EntryRef::Note(note)], Some(folder), 0).unwrap();
        assert_eq!(store.load(note).unwrap().parent_id, Some(folder));
    }

    #[test]
    fn all_folders_collapse_and_expand_together() {
        let store = NoteStore::open_in_memory().unwrap();
        let first = store.create_folder(None).unwrap().id;
        store.create_folder(None).unwrap();
        store.set_folder_collapsed(first, true).unwrap();
        store.set_all_folders_collapsed(true).unwrap();
        let collapsed = |store: &NoteStore| {
            store
                .list()
                .unwrap()
                .into_iter()
                .filter_map(|entry| match entry {
                    Entry::Folder(folder) => Some(folder.collapsed),
                    Entry::Note(_) | Entry::Media(_) => None,
                })
                .collect::<Vec<_>>()
        };
        assert_eq!(collapsed(&store), [true, true]);
        store.set_all_folders_collapsed(false).unwrap();
        assert_eq!(collapsed(&store), [false, false]);
    }

    #[test]
    fn new_entries_can_be_created_inside_a_folder() {
        let store = NoteStore::open_in_memory().unwrap();
        let folder = store.create_folder(None).unwrap().id;
        let existing = EntryRef::Note(store.create(Some(folder), None).unwrap().id);
        let note = store.create(Some(folder), None).unwrap();
        let inner = store.create_folder(Some(folder)).unwrap();
        assert_eq!((note.parent_id, inner.parent_id), (Some(folder), Some(folder)));
        assert_eq!(children(&store, Some(folder)), [EntryRef::Folder(inner.id), existing, EntryRef::Note(note.id)]);
        assert_eq!(store.load(note.id).unwrap().parent_id, Some(folder));
    }

    #[test]
    fn repeated_titles_get_the_next_free_number() {
        let store = NoteStore::open_in_memory().unwrap();
        let titles: Vec<String> = (0..3).map(|_| store.create(None, Some("Voice note")).unwrap().title).collect();
        assert_eq!(titles, ["Voice note", "Voice note 1", "Voice note 2"]);
    }

    #[test]
    fn creating_inside_missing_folder_is_not_found() {
        let store = NoteStore::open_in_memory().unwrap();
        assert!(matches!(store.create(Some(42), None), Err(Error::NotFound(FOLDER, 42))));
        assert!(matches!(store.create_folder(Some(42)), Err(Error::NotFound(FOLDER, 42))));
        assert!(store.list().unwrap().is_empty());
    }

    #[test]
    fn folders_stay_above_notes() {
        let store = NoteStore::open_in_memory().unwrap();
        let note = EntryRef::Note(store.create(None, None).unwrap().id);
        let [a, b] = [(); 2].map(|_| EntryRef::Folder(store.create_folder(None).unwrap().id));
        assert_eq!(children(&store, None), [a, b, note]);
        store.move_entries(&[note], None, 0).unwrap();
        assert_eq!(children(&store, None), [a, b, note]);
        store.move_entries(&[a], None, 99).unwrap();
        assert_eq!(children(&store, None), [b, a, note]);
    }

    #[test]
    fn moving_several_entries_keeps_their_order() {
        let store = NoteStore::open_in_memory().unwrap();
        let folder = store.create_folder(None).unwrap().id;
        let [a, b, c] = [(); 3].map(|_| EntryRef::Note(store.create(None, None).unwrap().id));
        store.move_entries(&[a, c], Some(folder), 0).unwrap();
        assert_eq!(children(&store, None), [EntryRef::Folder(folder), b]);
        assert_eq!(children(&store, Some(folder)), [a, c]);
    }

    #[test]
    fn duplicate_folder_copies_nested_contents_after_the_original() {
        let store = NoteStore::open_in_memory().unwrap();
        let outer = store.create_folder(None).unwrap();
        let inner = store.create_folder(None).unwrap().id;
        let after = EntryRef::Note(store.create(None, None).unwrap().id);
        let note = store.create(None, None).unwrap().id;
        store.rename(note, "Plan").unwrap();
        store.save(note, "- ship").unwrap();
        store.move_entries(&[EntryRef::Folder(inner)], Some(outer.id), 0).unwrap();
        store.move_entries(&[EntryRef::Note(note)], Some(inner), 0).unwrap();
        let copy = store.duplicate_entry(EntryRef::Folder(outer.id)).unwrap();
        assert_eq!(children(&store, None), [EntryRef::Folder(outer.id), copy, after]);
        assert!(store.list().unwrap().iter().any(|entry| matches!(entry, Entry::Folder(f) if f.name == "Untitled folder copy")));
        let EntryRef::Folder(copy) = copy else { panic!("expected a folder") };
        let [EntryRef::Folder(inner_copy)] = children(&store, Some(copy))[..] else { panic!("expected one folder") };
        let [EntryRef::Note(note_copy)] = children(&store, Some(inner_copy))[..] else { panic!("expected one note") };
        let loaded = store.load(note_copy).unwrap();
        assert_eq!((loaded.title.as_str(), loaded.body.as_str()), ("Plan copy", "- ship"));
        assert_eq!(children(&store, Some(inner)), [EntryRef::Note(note)]);
    }

    #[test]
    fn duplicating_missing_folder_is_not_found() {
        let store = NoteStore::open_in_memory().unwrap();
        assert!(matches!(store.duplicate_entry(EntryRef::Folder(42)), Err(Error::NotFound(FOLDER, 42))));
    }
}
