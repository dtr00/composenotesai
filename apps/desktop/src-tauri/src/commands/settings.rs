use crate::features::settings::{Settings, SettingsStore};
use crate::shared::error::Result;
use tauri::State;

#[tauri::command]
pub fn load_settings(store: State<SettingsStore>) -> Result<Settings> {
    store.load()
}

#[tauri::command]
pub fn save_settings(store: State<SettingsStore>, settings: Settings) -> Result<()> {
    store.save(&settings)
}
