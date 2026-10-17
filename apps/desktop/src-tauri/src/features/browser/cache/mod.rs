#[cfg_attr(target_os = "linux", path = "linux.rs")]
#[cfg_attr(target_os = "macos", path = "macos.rs")]
#[cfg_attr(windows, path = "windows.rs")]
mod platform;

use crate::shared::error::{Error, Result};
use tauri::AppHandle;
use tokio::sync::oneshot;

type Done = oneshot::Sender<std::result::Result<(), String>>;

const CLOSED: &str = "The browser closed before its cache was cleared.";

pub async fn clear_cache(app: &AppHandle) -> Result<()> {
    let (done, cleared) = oneshot::channel();
    platform::start_clearing(app, done)?;
    cleared.await.unwrap_or_else(|_| Err(CLOSED.into())).map_err(Error::Message)
}

#[cfg(not(target_os = "macos"))]
fn browser_tab(app: &AppHandle) -> Option<tauri::Webview> {
    use tauri::Manager;
    app.webviews().into_values().find(|view| view.label().starts_with(super::LABEL_PREFIX))
}

#[cfg(not(target_os = "macos"))]
fn clear_from_disk(app: &AppHandle, done: Done) -> Result<()> {
    let cleared = crate::shared::web_cache::clear_web_caches(&[super::data_directory(app)?]);
    let _ = done.send(cleared.map_err(|error| error.to_string()));
    Ok(())
}
