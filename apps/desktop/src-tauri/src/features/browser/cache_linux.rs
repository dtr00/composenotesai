use crate::shared::error::Result;
use tauri::Webview;
use webkit2gtk::gio::Cancellable;
use webkit2gtk::glib::TimeSpan;
use webkit2gtk::{WebViewExt, WebsiteDataManagerExtManual, WebsiteDataTypes};

pub fn clear_view_cache(view: &Webview) -> Result<()> {
    view.with_webview(|platform| {
        let Some(manager) = platform.inner().website_data_manager() else { return };
        let caches = WebsiteDataTypes::DISK_CACHE | WebsiteDataTypes::MEMORY_CACHE;
        manager.clear(caches, TimeSpan::from_seconds(0), None::<&Cancellable>, |cleared| {
            if let Err(error) = cleared {
                eprintln!("[browser] couldn't clear the cache: {error}");
            }
        });
    })?;
    Ok(())
}
