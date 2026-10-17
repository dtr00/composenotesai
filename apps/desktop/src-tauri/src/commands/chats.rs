use crate::features::chats::{read_text_file, text_attachment, ChatStore, ChatSummary, SavedChat, TextFile};
use crate::shared::error::Result;
use crate::shared::ipc::{encoded_header, raw_body};
use serde_json::Value;
use std::path::PathBuf;
use tauri::ipc::Request;
use tauri::State;

const NAME_HEADER: &str = "x-file-name";

#[tauri::command]
pub async fn read_chat_attachment(path: PathBuf) -> Result<TextFile> {
    read_text_file(&path)
}

#[tauri::command]
pub async fn read_chat_attachment_bytes(request: Request<'_>) -> Result<TextFile> {
    let name = encoded_header(&request, NAME_HEADER).unwrap_or_default();
    text_attachment(name, raw_body(&request).to_vec())
}

#[tauri::command]
pub fn list_chats(chats: State<ChatStore>) -> Result<Vec<ChatSummary>> {
    chats.list()
}

#[tauri::command]
pub fn load_chat(chats: State<ChatStore>, id: i64) -> Result<SavedChat> {
    chats.load(id)
}

#[tauri::command]
pub async fn save_chat(chats: State<'_, ChatStore>, id: Option<i64>, title: String, messages: Value) -> Result<i64> {
    chats.save(id, &title, &messages)
}

#[tauri::command]
pub fn delete_chat(chats: State<ChatStore>, id: i64) -> Result<()> {
    chats.delete(id)
}
