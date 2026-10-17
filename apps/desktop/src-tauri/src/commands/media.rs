use crate::entities::media::{media_formats, MediaFormat};
use crate::features::clipboard;
use crate::features::notes::{MediaInfo, MediaLink, MediaSummary, NoteStore};
use crate::shared::error::{Error, Result};
use crate::shared::ipc::{encoded_header, header, raw_body};
use serde::Serialize;
use std::fs::File;
use std::io::BufReader;
use std::path::PathBuf;
use tauri::ipc::{Request, Response};
use tauri::{AppHandle, State};

const NAME_HEADER: &str = "x-media-name";
const FOLDER_HEADER: &str = "x-folder-id";

#[tauri::command]
pub async fn create_media(notes: State<'_, NoteStore>, request: Request<'_>) -> Result<MediaSummary> {
    let name = encoded_header(&request, NAME_HEADER).unwrap_or_default();
    let parent = header(&request, FOLDER_HEADER).and_then(|id| id.parse().ok());
    notes.create_media(parent, &name, raw_body(&request))
}

#[tauri::command]
pub async fn import_media(
    notes: State<'_, NoteStore>,
    path: PathBuf,
    parent_id: Option<i64>,
) -> Result<MediaSummary> {
    let file = File::open(&path)?;
    let len = file.metadata()?.len();
    let name = path.file_name().and_then(|name| name.to_str()).unwrap_or_default();
    notes.create_media_from(parent_id, name, len, BufReader::new(file))
}

#[tauri::command]
pub async fn copied_files(app: AppHandle) -> Result<Vec<PathBuf>> {
    let (send, receive) = std::sync::mpsc::channel();
    app.run_on_main_thread(move || {
        let _ = send.send(clipboard::copied_files());
    })?;
    receive.recv().map_err(|_| Error::Message("Couldn't read the copied files.".into()))
}

pub struct MediaBase(pub String);

#[derive(Serialize)]
pub struct MediaConfig {
    base: String,
    formats: Vec<MediaFormat>,
}

#[tauri::command]
pub fn media_config(base: State<MediaBase>) -> MediaConfig {
    MediaConfig { base: base.0.clone(), formats: media_formats() }
}

#[tauri::command]
pub fn rename_media(notes: State<NoteStore>, id: i64, name: String) -> Result<Option<String>> {
    notes.rename_media(id, &name)
}

#[tauri::command]
pub async fn media_links(notes: State<'_, NoteStore>, ids: Vec<i64>) -> Result<Vec<MediaLink>> {
    notes.media_links(&ids)
}

#[tauri::command]
pub async fn read_media(notes: State<'_, NoteStore>, id: i64) -> Result<Response> {
    Ok(Response::new(notes.media_data(id)?))
}

#[tauri::command]
pub async fn media_info(notes: State<'_, NoteStore>, id: i64) -> Result<MediaInfo> {
    notes.media_info(id)
}
