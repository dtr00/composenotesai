use super::{browser_tab, clear_from_disk, Done};
use crate::shared::error::Result;
use tauri::AppHandle;
use webkit2gtk::gio::Cancellable;
use webkit2gtk::glib::TimeSpan;
use webkit2gtk::{WebViewExt, WebsiteDataManagerExtManual, WebsiteDataTypes};

pub fn start_clearing(app: &AppHandle, done: Done) -> Result<()> {
    let Some(view) = browser_tab(app) else { return clear_from_disk(app, done) };
    view.with_webview(move |platform| {
        let Some(manager) = platform.inner().website_data_manager() else {
            let _ = done.send(Err("The browser has no website data store.".into()));
            return;
        };
        let caches = WebsiteDataTypes::DISK_CACHE | WebsiteDataTypes::MEMORY_CACHE;
        manager.clear(caches, TimeSpan::from_seconds(0), None::<&Cancellable>, move |cleared| {
            let _ = done.send(cleared.map_err(|error| error.to_string()));
        });
    })?;
    Ok(())
}
