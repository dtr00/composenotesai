use crate::features::updater::{self, UpdateEvent};
use crate::features::windows::is_main_window;
use crate::shared::error::Result;
use tauri::ipc::Channel;
use tauri::{AppHandle, WebviewWindow};

#[tauri::command]
pub async fn check_update(app: AppHandle) -> Result<Option<String>> {
    updater::check_update(&app).await
}

#[tauri::command]
pub async fn install_update(app: AppHandle, window: WebviewWindow, on_event: Channel<UpdateEvent>) -> Result<()> {
    if !is_main_window(&window) {
        return Ok(());
    }
    updater::install_update(&app, &on_event).await
}
