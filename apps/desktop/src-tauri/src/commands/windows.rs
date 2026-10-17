use crate::features::windows;
use crate::shared::error::Result;
use tauri::{AppHandle, Webview};

#[tauri::command]
pub async fn open_window(app: AppHandle, path: String) -> Result<()> {
    windows::open_window(&app, &path)?;
    Ok(())
}

#[tauri::command]
pub fn print_page(webview: Webview) -> Result<()> {
    webview.print()?;
    Ok(())
}
