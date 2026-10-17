use super::compression::text_size;
use super::io::NoteStore;
use super::model::NotesUsage;
use crate::shared::db::logical_bytes;
use crate::shared::error::Result;

pub(super) fn stored_bytes(filter: &str) -> String {
    format!(
        "(SELECT COALESCE(SUM(length(CAST(title AS BLOB)) + length(body)), 0) FROM notes WHERE {filter})
            + (SELECT COALESCE(SUM(length(CAST(name AS BLOB))), 0) FROM folders WHERE {filter})
            + (SELECT COALESCE(SUM(length(CAST(name AS BLOB)) + length(data)), 0) FROM media WHERE {filter})"
    )
}

impl NoteStore {
    pub fn database_bytes(&self) -> Result<u64> {
        logical_bytes(&self.db.lock().conn)
    }

    pub fn usage(&self) -> Result<NotesUsage> {
        let store = self.db.lock();
        let mut usage = NotesUsage::default();
        let mut stmt = store.conn.prepare("SELECT length(CAST(title AS BLOB)), body FROM live_notes")?;
        let mut rows = stmt.query([])?;
        while let Some(row) = rows.next()? {
            let title = row.get::<_, i64>(0)?.unsigned_abs();
            let body: Vec<u8> = row.get(1)?;
            usage.notes += 1;
            usage.text_bytes += title + text_size(&body);
            usage.note_bytes += title + body.len() as u64;
        }
        let (folders, names): (i64, i64) = store.conn.query_row(
            "SELECT count(*), COALESCE(SUM(length(CAST(name AS BLOB))), 0) FROM live_folders",
            [],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )?;
        usage.folders = folders.unsigned_abs();
        usage.text_bytes += names.unsigned_abs();
        usage.folder_bytes = names.unsigned_abs();
        let (media, media_bytes): (i64, i64) = store.conn.query_row(
            "SELECT count(*), COALESCE(SUM(length(CAST(name AS BLOB)) + length(data)), 0) FROM live_media",
            [],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )?;
        usage.media = media.unsigned_abs();
        usage.media_bytes = media_bytes.unsigned_abs();
        let trash_sql = format!("SELECT {}", stored_bytes("trash_id IS NOT NULL"));
        let trash: i64 = store.conn.query_row(&trash_sql, [], |r| r.get(0))?;
        usage.trash_bytes = trash.unsigned_abs();
        Ok(usage)
    }
}

#[cfg(test)]
mod tests {
    use super::super::model::UNTITLED_FOLDER;
    use super::*;

    #[test]
    fn usage_counts_entries_and_compares_text_to_stored_bytes() {
        let store = NoteStore::open_in_memory().unwrap();
        assert_eq!(store.usage().unwrap(), NotesUsage::default());
        let note = store.create(None, None).unwrap();
        store.save(note.id, &"A repeated line of note text.\n".repeat(40)).unwrap();
        store.create_folder(None).unwrap();
        let usage = store.usage().unwrap();
        assert_eq!((usage.notes, usage.folders), (1, 1));
        assert!(usage.note_bytes + usage.folder_bytes < usage.text_bytes);
        assert_eq!(usage.folder_bytes, UNTITLED_FOLDER.len() as u64);
    }
}
