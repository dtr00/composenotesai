use crate::features::updater::{self, UpdateEvent};
use crate::shared::error::Result;
use tauri::ipc::Channel;
use tauri::AppHandle;

#[tauri::command]
pub async fn check_update(app: AppHandle) -> Result<Option<String>> {
    updater::check_update(&app).await
}

#[tauri::command]
pub async fn install_update(app: AppHandle, on_event: Channel<UpdateEvent>) -> Result<()> {
    updater::install_update(&app, &on_event).await
}
