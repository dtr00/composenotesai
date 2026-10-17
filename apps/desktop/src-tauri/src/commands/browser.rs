use crate::features::browser::{self, AppHotkeys, Bounds, Binding};
use crate::shared::error::Result;
use tauri::{AppHandle, State, Window};

#[tauri::command]
pub fn browser_set_hotkeys(hotkeys: State<'_, AppHotkeys>, bindings: Vec<Binding>) {
    hotkeys.set(bindings);
}

#[tauri::command]
pub async fn browser_show(window: Window, tab: u32, url: Option<String>, bounds: Bounds) -> Result<()> {
    browser::show(&window, tab, url.as_deref(), bounds)
}

#[tauri::command]
pub async fn browser_set_bounds(window: Window, tab: u32, bounds: Bounds) -> Result<()> {
    browser::set_bounds(&window, tab, bounds)
}

#[tauri::command]
pub async fn browser_hide(window: Window, tab: u32) -> Result<()> {
    browser::hide(&window, tab)
}

#[tauri::command]
pub async fn browser_reload(window: Window, tab: u32) -> Result<()> {
    browser::reload(&window, tab)
}

#[tauri::command]
pub async fn browser_stop(window: Window, tab: u32) -> Result<()> {
    browser::stop(&window, tab)
}

#[tauri::command]
pub async fn browser_close(window: Window, tab: u32) -> Result<()> {
    browser::close(&window, tab)
}

#[tauri::command]
pub async fn browser_close_all(window: Window) -> Result<()> {
    browser::close_all(&window)
}

#[tauri::command]
pub async fn browser_clear_cache(app: AppHandle) -> Result<()> {
    browser::clear_cache(&app)
}
