use super::io::{live_media_names, next_position, parent_of, refuse_taken_name, NoteStore};
use super::media_names::{free_media_name, split_media_name};
use super::model::{EntryRef, MediaSummary, MEDIA};
use crate::entities::media::{unsupported_media, MediaKind, SNIFF_BYTES};
use crate::shared::db::now_ms;
use crate::shared::error::{Error, Result};
use crate::shared::media_server::{MediaReader, Slice};
use rusqlite::{params, Connection, OptionalExtension, MAIN_DB};
use std::io::{self, Read, Write};
use tauri::{AppHandle, Manager};

const SLICE_LIMIT: u64 = 4 * 1024 * 1024;

fn stored_kind(conn: &Connection, id: i64) -> Result<&'static MediaKind> {
    let mime: String = conn
        .query_row("SELECT mime FROM live_media WHERE id = ?1", [id], |r| r.get(0))
        .optional()?
        .ok_or(Error::NotFound(MEDIA, id))?;
    MediaKind::from_mime(&mime).ok_or_else(|| Error::Message(format!("File {id} has an unknown file type.")))
}

pub struct NoteMedia(pub AppHandle);

impl MediaReader for NoteMedia {
    fn read(&self, id: i64, start: u64, last: Option<u64>) -> Result<Slice> {
        self.0.state::<NoteStore>().media_slice(id, start, last)
    }
}

impl NoteStore {
    pub fn create_media(&self, parent: Option<i64>, name: &str, data: &[u8]) -> Result<MediaSummary> {
        self.create_media_from(parent, name, data.len() as u64, data)
    }

    pub fn create_media_from(
        &self,
        parent: Option<i64>,
        name: &str,
        len: u64,
        mut source: impl Read,
    ) -> Result<MediaSummary> {
        let mut head = vec![0; SNIFF_BYTES.min(usize::try_from(len).unwrap_or(SNIFF_BYTES))];
        source.read_exact(&mut head)?;
        let kind = MediaKind::sniff(&head, name).filter(|kind| kind.fits(len)).ok_or_else(unsupported_media)?;
        let size = i64::try_from(len).map_err(|_| unsupported_media())?;
        let mut store = self.db.lock();
        let tx = store.conn.transaction()?;
        if let Some(id) = parent {
            parent_of(&tx, EntryRef::Folder(id))?;
        }
        let (stem, _) = split_media_name(name.trim());
        let untitled = format!("Pasted {}", kind.media_type.noun());
        let stem = Some(stem.trim()).filter(|stem| !stem.is_empty()).unwrap_or(&untitled);
        let names = live_media_names(&tx)?;
        let name = free_media_name(stem, Some(kind.extension), names.iter().map(String::as_str));
        tx.execute(
            "INSERT INTO media (name, created_at, folder_id, position, mime, data)
             VALUES (?1, ?2, ?3, ?4, ?5, zeroblob(?6))",
            params![name, now_ms(), parent, next_position(&tx, parent)?, kind.mime, size],
        )?;
        let id = tx.last_insert_rowid();
        let mut blob = tx.blob_open(MAIN_DB, c"media", c"data", id, false)?;
        blob.write_all(&head)?;
        io::copy(&mut source, &mut blob)?;
        drop(blob);
        tx.commit()?;
        Ok(MediaSummary::new(id, name, parent, kind, len))
    }

    fn read_media(&self, id: i64, start: u64, end: u64) -> Result<Slice> {
        let store = self.db.lock();
        let kind = stored_kind(&store.conn, id)?;
        let blob = store.conn.blob_open(MAIN_DB, c"media", c"data", id, true)?;
        let total = blob.len() as u64;
        let start = start.min(total);
        let end = end.min(total).max(start);
        let mut data = vec![0; usize::try_from(end - start).unwrap_or(0)];
        blob.read_at_exact(&mut data, usize::try_from(start).unwrap_or(0))?;
        Ok(Slice { mime: kind.mime, total, start, data })
    }

    pub fn media_slice(&self, id: i64, start: u64, last: Option<u64>) -> Result<Slice> {
        let end = last.map_or(u64::MAX, |last| last.saturating_add(1)).min(start.saturating_add(SLICE_LIMIT));
        self.read_media(id, start, end)
    }

    pub fn rename_media(&self, id: i64, name: &str) -> Result<Option<String>> {
        let (stem, _) = split_media_name(name.trim());
        let stem = stem.trim();
        if stem.is_empty() {
            return Ok(None);
        }
        let store = self.db.lock();
        let name = stored_kind(&store.conn, id)?.file_name(stem);
        refuse_taken_name(&store.conn, "SELECT name FROM live_media WHERE id != ?1", id, MEDIA, &name)?;
        store.conn.execute("UPDATE media SET name = ?1 WHERE id = ?2", params![name, id])?;
        Ok(Some(name))
    }

    pub fn media_data(&self, id: i64) -> Result<Vec<u8>> {
        Ok(self.read_media(id, 0, u64::MAX)?.data)
    }
}

#[cfg(test)]
mod tests {
    use super::super::io::order;
    use super::super::model::{Entry, EntryCounts, EntryType, FOLDER};
    use super::*;
    use crate::entities::media::MediaType;

    const PNG: &[u8] = b"\x89PNG\r\n\x1a\npixels";

    #[test]
    fn saved_images_load_back_and_list_with_notes() {
        let store = NoteStore::open_in_memory().unwrap();
        let folder = store.create_folder(None).unwrap().id;
        let note = store.create(None, None).unwrap().id;
        let image = store.create_media(None, "Pasted image", PNG).unwrap();
        assert_eq!((image.name.as_str(), image.parent_id), ("Pasted image.png", None));
        assert_eq!(store.media_data(image.id).unwrap(), PNG);
        assert_eq!(order(&store), [EntryRef::Folder(folder), EntryRef::Note(note), EntryRef::Media(image.id)]);
    }

    #[test]
    fn images_can_be_saved_into_a_folder() {
        let store = NoteStore::open_in_memory().unwrap();
        let folder = store.create_folder(None).unwrap().id;
        let image = store.create_media(Some(folder), "Diagram", PNG).unwrap();
        assert_eq!(image.parent_id, Some(folder));
        assert!(matches!(store.create_media(Some(42), "x", PNG), Err(Error::NotFound(FOLDER, 42))));
    }

    #[test]
    fn image_names_count_up_and_default_when_blank() {
        let store = NoteStore::open_in_memory().unwrap();
        let names: Vec<String> = ["Pasted image", "Pasted image", "  "]
            .map(|name| store.create_media(None, name, PNG).unwrap().name)
            .into();
        assert_eq!(names, ["Pasted image.png", "Pasted image 1.png", "Pasted image 2.png"]);
    }

    #[test]
    fn media_names_always_end_with_their_type() {
        let store = NoteStore::open_in_memory().unwrap();
        let image = store.create_media(None, "screenshot.jpg", PNG).unwrap();
        assert_eq!(image.name, "screenshot.png");
        store.rename_media(image.id, "Diagram").unwrap();
        store.rename_media(image.id, "Diagram v2.gif").unwrap();
        let names: Vec<String> = store
            .list()
            .unwrap()
            .into_iter()
            .filter_map(|entry| if let Entry::Media(media) = entry { Some(media.name) } else { None })
            .collect();
        assert_eq!(names, ["Diagram v2.png"]);
    }

    #[test]
    fn files_that_are_not_images_are_rejected() {
        let store = NoteStore::open_in_memory().unwrap();
        let refused = store.create_media(None, "script", b"#!/bin/sh").unwrap_err();
        assert_eq!(refused.to_string(), unsupported_media().to_string());
        assert!(store.list().unwrap().is_empty());
    }

    #[test]
    fn images_rename_move_and_copy_like_notes() {
        let store = NoteStore::open_in_memory().unwrap();
        let folder = store.create_folder(None).unwrap().id;
        let image = EntryRef::Media(store.create_media(None, "Photo", PNG).unwrap().id);
        store.rename_media(image.id(), "Holiday").unwrap();
        store.move_entries(&[image], Some(folder), 0).unwrap();
        let copy = store.duplicate_entry(image).unwrap();
        assert_eq!(store.media_data(copy.id()).unwrap(), PNG);
        let names: Vec<(String, Option<i64>)> = store
            .list()
            .unwrap()
            .into_iter()
            .filter_map(|entry| match entry {
                Entry::Media(media) => Some((media.name, media.parent_id)),
                Entry::Note(_) | Entry::Folder(_) => None,
            })
            .collect();
        assert_eq!(names, [("Holiday.png".into(), Some(folder)), ("Holiday copy.png".into(), Some(folder))]);
        assert!(matches!(store.rename_media(42, "x"), Err(Error::NotFound(MEDIA, 42))));
    }

    #[test]
    fn media_names_stay_unique() {
        let store = NoteStore::open_in_memory().unwrap();
        let photo = store.create_media(None, "Photo", PNG).unwrap().id;
        let other = store.create_media(None, "Other", PNG).unwrap().id;
        assert!(store.rename_media(other, " photo ").unwrap_err().to_string().contains("already a file named"));
        store.rename_media(photo, "PHOTO").unwrap();
        store.rename_media(other, "Photo 2").unwrap();
        let trashed = store.trash_entries(&[EntryRef::Media(photo)]).unwrap();
        store.rename_media(other, "Photo").unwrap();
        store.restore_trash(&trashed.trash_ids).unwrap();
        let mut names: Vec<String> = store
            .list()
            .unwrap()
            .into_iter()
            .filter_map(|entry| if let Entry::Media(media) = entry { Some(media.name) } else { None })
            .collect();
        names.sort();
        assert_eq!(names, ["PHOTO 1.png", "Photo.png"]);
    }

    #[test]
    fn trashed_images_are_hidden_until_restored() {
        let store = NoteStore::open_in_memory().unwrap();
        let folder = store.create_folder(None).unwrap().id;
        let image = store.create_media(Some(folder), "Photo", PNG).unwrap().id;
        let trashed = store.trash_entries(&[EntryRef::Folder(folder)]).unwrap();
        assert_eq!(trashed.removed, [EntryRef::Folder(folder), EntryRef::Media(image)]);
        assert!(matches!(store.media_data(image), Err(Error::NotFound(MEDIA, _))));
        assert!(store.usage().unwrap().trash_bytes >= PNG.len() as u64);
        let folder_item = &store.list_trash().unwrap()[0];
        let counts = EntryCounts { note: 0, image: 1, video: 0, document: 0 };
        assert_eq!((folder_item.entry_type, &folder_item.counts), (EntryType::Folder, &counts));
        store.restore_trash(&trashed.trash_ids).unwrap();
        assert_eq!(store.media_data(image).unwrap(), PNG);
        let alone = store.trash_entries(&[EntryRef::Media(image)]).unwrap();
        let items = store.list_trash().unwrap();
        let item = (items[0].entry, items[0].entry_type, items[0].name.as_str());
        assert_eq!(item, (EntryRef::Media(image), EntryType::Image, "Photo.png"));
        store.delete_from_trash(&alone.trash_ids).unwrap();
        assert!(store.list_trash().unwrap().is_empty());
        assert_eq!(store.usage().unwrap().trash_bytes, 0);
    }

    #[test]
    fn upgrading_keeps_trashed_notes_and_folders() {
        use super::super::schema::MIGRATIONS;
        use crate::shared::db::{migrate, open_in_memory};
        let conn = open_in_memory(&MIGRATIONS[..4]).unwrap();
        conn.execute_batch(
            "INSERT INTO trash (id, deleted_at, is_folder, entry_id) VALUES (1, 0, 1, 7), (2, 0, 0, 9);
             INSERT INTO folders (id, name, position, trash_id) VALUES (7, 'Old folder', 0, 1);
             INSERT INTO notes (id, title, body, dict_id, created_at, updated_at, position, trash_id)
                 VALUES (9, 'Old note', x'', 1, 0, 0, 0, 2);",
        )
        .unwrap();
        migrate(&conn, MIGRATIONS).unwrap();
        let store = NoteStore::new(conn).unwrap();
        let trashed: Vec<(EntryRef, String)> =
            store.list_trash().unwrap().into_iter().map(|item| (item.entry, item.name)).collect();
        assert_eq!(trashed, [(EntryRef::Note(9), "Old note".into()), (EntryRef::Folder(7), "Old folder".into())]);
    }

    fn mp4(len: usize) -> Vec<u8> {
        let mut video = b"\0\0\0\x20ftypisom\0\0\0\0".to_vec();
        video.extend((0..len).map(|i| (i % 251) as u8));
        video
    }

    #[test]
    fn videos_stream_in_and_list_as_videos() {
        let store = NoteStore::open_in_memory().unwrap();
        let video = mp4(10_000);
        let saved = store.create_media_from(None, "Clip", video.len() as u64, video.as_slice()).unwrap();
        assert_eq!(saved.media_type, MediaType::Video);
        assert!(matches!(&store.list().unwrap()[0], Entry::Media(media) if media.media_type == MediaType::Video && media.name == "Clip.mp4"));
        assert_eq!(store.media_data(saved.id).unwrap(), video);
    }

    #[test]
    fn documents_are_saved_with_their_type_and_size() {
        let store = NoteStore::open_in_memory().unwrap();
        let pdf = b"%PDF-1.7\n%%EOF";
        let saved = store.create_media(None, "Report.pdf", pdf).unwrap();
        assert_eq!((saved.name.as_str(), saved.media_type, saved.bytes), ("Report.pdf", MediaType::Document, 14));
        let docx = store.create_media(None, "Letter.docx", b"PK\x03\x04word").unwrap();
        assert_eq!((docx.name.as_str(), docx.media_type), ("Letter.docx", MediaType::Document));
        let untitled = store.create_media(None, "", pdf).unwrap();
        assert_eq!(untitled.name, "Pasted document.pdf");
        let refused = store.create_media(None, "Archive.zip", b"PK\x03\x04").unwrap_err();
        assert_eq!(refused.to_string(), unsupported_media().to_string());
        assert!(matches!(&store.list().unwrap()[0], Entry::Media(media) if media.bytes == 14 && media.mime == "application/pdf"));
    }

    #[test]
    fn media_data_reads_past_the_slice_limit() {
        let store = NoteStore::open_in_memory().unwrap();
        let video = mp4(SLICE_LIMIT as usize + 10);
        let id = store.create_media(None, "Clip", &video).unwrap().id;
        assert_eq!(store.media_data(id).unwrap(), video);
        assert!(matches!(store.media_data(42), Err(Error::NotFound(MEDIA, 42))));
    }

    #[test]
    fn media_ranges_return_the_requested_slice() {
        let store = NoteStore::open_in_memory().unwrap();
        let video = mp4(10_000);
        let id = store.create_media(None, "Clip", &video).unwrap().id;
        let slice = store.media_slice(id, 100, Some(199)).unwrap();
        assert_eq!((slice.mime, slice.total, slice.start), ("video/mp4", video.len() as u64, 100));
        assert_eq!(slice.data, video[100..200]);
        let tail = store.media_slice(id, 9_990, None).unwrap();
        assert_eq!(tail.data, video[9_990..]);
        let image = store.create_media(None, "Photo", PNG).unwrap().id;
        assert_eq!(store.media_slice(image, 0, None).unwrap().data, PNG);
    }

    #[test]
    fn usage_counts_image_bytes() {
        let store = NoteStore::open_in_memory().unwrap();
        store.create_media(None, "Photo", PNG).unwrap();
        let usage = store.usage().unwrap();
        assert_eq!((usage.media, usage.media_bytes), (1, (PNG.len() + "Photo.png".len()) as u64));
    }
}
