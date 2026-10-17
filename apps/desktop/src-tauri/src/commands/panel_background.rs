use crate::features::panel_background;
use crate::shared::error::Result;
use crate::shared::ipc::raw_body;
use tauri::ipc::{Request, Response};
use tauri::{AppHandle, Manager};

#[tauri::command]
pub async fn load_panel_background(app: AppHandle) -> Result<Response> {
    Ok(Response::new(panel_background::load(&app.path().app_data_dir()?)?))
}

#[tauri::command]
pub async fn save_panel_background(app: AppHandle, request: Request<'_>) -> Result<()> {
    panel_background::save(&app.path().app_data_dir()?, raw_body(&request))
}

#[tauri::command]
pub async fn clear_panel_background(app: AppHandle) -> Result<()> {
    panel_background::clear(&app.path().app_data_dir()?)
}
