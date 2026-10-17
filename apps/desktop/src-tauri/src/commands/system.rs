use crate::features::system::{SystemInfo, SystemMonitor, SystemUsage};
use crate::shared::error::Result;
use tauri::{AppHandle, Manager, State};

#[tauri::command]
pub async fn system_info(monitor: State<'_, SystemMonitor>) -> Result<SystemInfo> {
    Ok(monitor.info())
}

#[tauri::command]
pub async fn system_usage(app: AppHandle, monitor: State<'_, SystemMonitor>) -> Result<SystemUsage> {
    Ok(monitor.usage(&app.path().app_data_dir()?))
}
