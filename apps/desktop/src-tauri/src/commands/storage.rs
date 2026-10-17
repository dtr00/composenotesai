use crate::features::ai::{Engine, LanguageModels};
use crate::features::chats::ChatStore;
use crate::features::notes::{NoteStore, NotesUsage};
use crate::features::panel_background::background_path;
use crate::features::settings::{SettingBytes, SettingsStore};
use crate::features::skills::SkillStore;
use crate::features::speech_models::SpeechModels;
use crate::features::storage::{ai_dir, app_bytes, webview_usage, WebviewBytes};
use crate::shared::db::database_files;
use crate::shared::disk::file_bytes;
use crate::shared::error::Result;
use serde::Serialize;
use tauri::{AppHandle, Manager};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredModel {
    name: String,
    bytes: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiDataUsage {
    chats: u64,
    chat_bytes: u64,
    skill_bytes: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageUsage {
    folder: String,
    app_bytes: u64,
    database_bytes: u64,
    log_bytes: u64,
    background_bytes: u64,
    settings: Vec<SettingBytes>,
    notes: NotesUsage,
    ai: AiDataUsage,
    webview: Vec<WebviewBytes>,
    speech_models: Vec<StoredModel>,
    language_models: Vec<StoredModel>,
    engine_bytes: u64,
}

#[tauri::command]
pub async fn storage_usage(app: AppHandle) -> Result<StorageUsage> {
    let data_dir = app.path().app_data_dir()?;
    let [database, wal, shm] = database_files(&data_dir);
    let background = background_path(&data_dir);
    let speech = app.state::<SpeechModels>();
    let notes = app.state::<NoteStore>();
    let (chats, chat_bytes) = app.state::<ChatStore>().stored_bytes()?;
    Ok(StorageUsage {
        folder: data_dir.display().to_string(),
        app_bytes: app_bytes(),
        database_bytes: notes.database_bytes()?,
        log_bytes: file_bytes(&wal) + file_bytes(&shm),
        background_bytes: file_bytes(&background),
        settings: app.state::<SettingsStore>().stored_bytes()?,
        notes: notes.usage()?,
        ai: AiDataUsage { chats, chat_bytes, skill_bytes: app.state::<SkillStore>().stored_bytes()? },
        webview: webview_usage(&app, &[database, wal, shm, background, speech.dir().into(), ai_dir(&data_dir)]),
        speech_models: speech
            .list()
            .into_iter()
            .filter(|model| model.installed)
            .map(|model| StoredModel { name: model.name.into(), bytes: model.size_bytes })
            .collect(),
        language_models: app
            .state::<LanguageModels>()
            .installed()
            .into_iter()
            .map(|model| StoredModel { name: model.name, bytes: model.size_bytes })
            .collect(),
        engine_bytes: app.state::<Engine>().installed_bytes(),
    })
}
