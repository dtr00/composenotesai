use super::Done;
use crate::shared::error::Result;
use block2::RcBlock;
use objc2::MainThreadMarker;
use objc2_foundation::{NSDate, NSSet};
use objc2_web_kit::{WKWebsiteDataStore, WKWebsiteDataTypeDiskCache, WKWebsiteDataTypeMemoryCache};
use std::cell::Cell;
use tauri::AppHandle;

// WKWebView ignores the data folder, so browser tabs share the default data store with the app.
pub fn start_clearing(app: &AppHandle, done: Done) -> Result<()> {
    app.run_on_main_thread(move || {
        let Some(main) = MainThreadMarker::new() else {
            let _ = done.send(Err("The cache can only be cleared on the main thread.".into()));
            return;
        };
        let done = Cell::new(Some(done));
        let finished = RcBlock::new(move || {
            if let Some(done) = done.take() {
                let _ = done.send(Ok(()));
            }
        });
        unsafe {
            let caches = NSSet::from_slice(&[WKWebsiteDataTypeDiskCache, WKWebsiteDataTypeMemoryCache]);
            WKWebsiteDataStore::defaultDataStore(main).removeDataOfTypes_modifiedSince_completionHandler(
                &caches,
                &NSDate::distantPast(),
                &finished,
            );
        }
    })?;
    Ok(())
}
