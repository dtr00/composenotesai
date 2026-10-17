mod attachment;

pub use attachment::{read_text_file, text_attachment, TextFile};

use crate::shared::compression::decompress_bounded;
use crate::shared::db::now_ms;
use crate::shared::error::{Error, Result};
use crate::shared::lock::Lock;
use crate::shared::text::collapse_whitespace;
use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;
use serde_json::Value;
use zstd::bulk::Decompressor;

pub const CREATE_CHATS_TABLE: &str = "
CREATE TABLE IF NOT EXISTS chats (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    messages BLOB NOT NULL
);";

const LEVEL: i32 = 9;
const MAX_TITLE_CHARS: usize = 120;
const MAX_CHAT_BYTES: u64 = 16 << 20;
const LISTED_CHATS: i64 = 200;
const CHAT: &str = "Chat";

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ChatSummary {
    pub id: i64,
    pub title: String,
    pub updated_at: i64,
}

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SavedChat {
    pub id: i64,
    pub title: String,
    pub messages: Value,
}

pub struct ChatStore {
    conn: Lock<Connection>,
}

fn corrupt(id: i64) -> Error {
    Error::Message(format!("Chat {id} couldn't be read."))
}

impl ChatStore {
    pub fn new(conn: Connection) -> Self {
        Self { conn: Lock::new(conn) }
    }

    #[cfg(test)]
    fn open_in_memory() -> Result<Self> {
        let migrations = [crate::shared::db::Migration::Sql(CREATE_CHATS_TABLE)];
        Ok(Self::new(crate::shared::db::open_in_memory(&migrations)?))
    }

    pub fn list(&self) -> Result<Vec<ChatSummary>> {
        let conn = self.conn.lock();
        let mut stmt =
            conn.prepare("SELECT id, title, updated_at FROM chats ORDER BY updated_at DESC, id DESC LIMIT ?1")?;
        let rows = stmt.query_map([LISTED_CHATS], |r| {
            Ok(ChatSummary { id: r.get(0)?, title: r.get(1)?, updated_at: r.get(2)? })
        })?;
        Ok(rows.collect::<rusqlite::Result<_>>()?)
    }

    pub fn load(&self, id: i64) -> Result<SavedChat> {
        let (title, data): (String, Vec<u8>) = self
            .conn
            .lock()
            .query_row("SELECT title, messages FROM chats WHERE id = ?1", [id], |r| Ok((r.get(0)?, r.get(1)?)))
            .optional()?
            .ok_or(Error::NotFound(CHAT, id))?;
        let json = Decompressor::new()
            .and_then(|mut decompressor| decompress_bounded(&mut decompressor, &data, MAX_CHAT_BYTES))
            .map_err(|_| corrupt(id))?;
        let messages = serde_json::from_slice(&json).map_err(|_| corrupt(id))?;
        Ok(SavedChat { id, title, messages })
    }

    pub fn save(&self, id: Option<i64>, title: &str, messages: &Value) -> Result<i64> {
        let title: String = collapse_whitespace(title).chars().take(MAX_TITLE_CHARS).collect();
        let json = serde_json::to_vec(messages)?;
        if json.len() as u64 > MAX_CHAT_BYTES {
            return Err(Error::Message("This chat is too long to save. Start a new chat.".into()));
        }
        let data = zstd::bulk::compress(&json, LEVEL)?;
        let conn = self.conn.lock();
        let now = now_ms();
        if let Some(id) = id {
            let changed = conn.execute(
                "UPDATE chats SET title = ?1, messages = ?2, updated_at = ?3 WHERE id = ?4",
                params![title, data, now, id],
            )?;
            if changed > 0 {
                return Ok(id);
            }
        }
        conn.execute(
            "INSERT INTO chats (title, created_at, updated_at, messages) VALUES (?1, ?2, ?2, ?3)",
            params![title, now, data],
        )?;
        Ok(conn.last_insert_rowid())
    }

    pub fn delete(&self, id: i64) -> Result<()> {
        self.conn.lock().execute("DELETE FROM chats WHERE id = ?1", [id])?;
        Ok(())
    }

    pub fn stored_bytes(&self) -> Result<(u64, u64)> {
        let (count, bytes): (i64, i64) = self.conn.lock().query_row(
            "SELECT count(*), COALESCE(SUM(length(CAST(title AS BLOB)) + length(messages)), 0) FROM chats",
            [],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )?;
        Ok((count.unsigned_abs(), bytes.unsigned_abs()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn saves_compressed_chats_and_loads_them_back() {
        let store = ChatStore::open_in_memory().unwrap();
        let messages = json!([{ "role": "user", "content": "Hello ".repeat(200) }]);
        let id = store.save(None, "  First   chat ", &messages).unwrap();
        let saved = store.load(id).unwrap();
        assert_eq!((saved.title.as_str(), &saved.messages), ("First chat", &messages));
        let (count, bytes) = store.stored_bytes().unwrap();
        assert_eq!(count, 1);
        assert!(bytes < serde_json::to_vec(&messages).unwrap().len() as u64);
    }

    #[test]
    fn saving_again_updates_and_recent_chats_come_first() {
        let store = ChatStore::open_in_memory().unwrap();
        let first = store.save(None, "First", &json!([])).unwrap();
        let second = store.save(None, "Second", &json!([])).unwrap();
        std::thread::sleep(std::time::Duration::from_millis(2));
        assert_eq!(store.save(Some(first), "First again", &json!([1])).unwrap(), first);
        let listed: Vec<i64> = store.list().unwrap().iter().map(|chat| chat.id).collect();
        assert_eq!(listed, [first, second]);
        assert_eq!(store.load(first).unwrap().messages, json!([1]));
    }

    #[test]
    fn saving_a_deleted_chat_creates_a_new_one() {
        let store = ChatStore::open_in_memory().unwrap();
        let id = store.save(None, "Gone", &json!([])).unwrap();
        store.delete(id).unwrap();
        assert!(store.load(id).is_err());
        let again = store.save(Some(id), "Back", &json!([])).unwrap();
        assert_eq!(store.list().unwrap().len(), 1);
        assert_eq!(store.load(again).unwrap().title, "Back");
    }
}
