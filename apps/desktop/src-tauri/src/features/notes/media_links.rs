use super::io::NoteStore;
use super::model::{MediaInfo, MediaLink, NoteFormat, NoteSummary, MEDIA};
use crate::shared::error::{Error, Result};
use rusqlite::OptionalExtension;
use std::collections::BTreeSet;

const MEDIA_SCHEMES: [&str; 6] = ["(image", "<image", "(video", "<video", "(document", "<document"];

fn linked_media(body: &str) -> BTreeSet<i64> {
    body.match_indices(':')
        .filter(|&(at, _)| MEDIA_SCHEMES.iter().any(|scheme| body[..at].ends_with(scheme)))
        .filter_map(|(at, _)| {
            let rest = &body[at + 1..];
            let digits = rest.find(|c: char| !c.is_ascii_digit()).unwrap_or(rest.len());
            rest[..digits].parse().ok()
        })
        .collect()
}

impl NoteStore {
    pub fn media_links(&self, media: &[i64]) -> Result<Vec<MediaLink>> {
        let mut store = self.db.lock();
        let notes: Vec<(NoteSummary, Vec<u8>, u32)> = store
            .conn
            .prepare(
                "SELECT id, title, folder_id, body, dict_id FROM live_notes WHERE format = 'markdown' ORDER BY title",
            )?
            .query_map([], |r| {
                let format = NoteFormat::Markdown;
                let note = NoteSummary { id: r.get(0)?, title: r.get(1)?, parent_id: r.get(2)?, format };
                Ok((note, r.get(3)?, r.get(4)?))
            })?
            .collect::<rusqlite::Result<_>>()?;
        let mut links = Vec::new();
        for (note, body, dict_id) in notes {
            let Ok(body) = store.codec.decompress(dict_id, &body) else { continue };
            for media_id in linked_media(&body).into_iter().filter(|media_id| media.contains(media_id)) {
                links.push(MediaLink { media_id, note: note.clone() });
            }
        }
        Ok(links)
    }

    pub fn media_info(&self, id: i64) -> Result<MediaInfo> {
        let created_at = self
            .db
            .lock()
            .conn
            .query_row("SELECT created_at FROM live_media WHERE id = ?1", [id], |r| r.get(0))
            .optional()?
            .ok_or(Error::NotFound(MEDIA, id))?;
        let notes = self.media_links(&[id])?.into_iter().map(|link| link.note).collect();
        Ok(MediaInfo { created_at, notes })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const PNG: &[u8] = b"\x89PNG\r\n\x1a\npixels";

    #[test]
    fn links_are_found_only_in_media_urls() {
        let body = "![a](image:3) ![b|200](video:12)\n<image:7> image:9 (image:x) ![c](image:3) ![d](document:5)";
        assert_eq!(linked_media(body), BTreeSet::from([3, 5, 7, 12]));
    }

    #[test]
    fn notes_that_embed_media_are_listed_with_their_info() {
        let store = NoteStore::open_in_memory().unwrap();
        let image = store.create_media(None, "Diagram", PNG).unwrap().id;
        let other = store.create_media(None, "Other", PNG).unwrap().id;
        let linking = store.create(None, None).unwrap().id;
        let unrelated = store.create(None, None).unwrap().id;
        store.save(linking, &format!("See ![Diagram](image:{image})")).unwrap();
        store.save(unrelated, &format!("![x](image:{image}0)")).unwrap();
        let links = store.media_links(&[image, other]).unwrap();
        assert_eq!(links.iter().map(|link| (link.media_id, link.note.id)).collect::<Vec<_>>(), [(image, linking)]);
        let info = store.media_info(image).unwrap();
        assert_eq!(info.notes.len(), 1);
        assert!(store.media_info(other).unwrap().notes.is_empty());
    }
}
