use crate::shared::error::Result;
use block2::RcBlock;
use objc2::MainThreadMarker;
use objc2_foundation::{NSDate, NSSet};
use objc2_web_kit::{WKWebsiteDataStore, WKWebsiteDataTypeDiskCache, WKWebsiteDataTypeMemoryCache};
use tauri::AppHandle;

// WKWebView ignores the data folder, so browser tabs share the default data store with the app.
pub fn clear_cache(app: &AppHandle) -> Result<()> {
    app.run_on_main_thread(|| {
        let Some(main) = MainThreadMarker::new() else { return };
        unsafe {
            let caches = NSSet::from_slice(&[WKWebsiteDataTypeDiskCache, WKWebsiteDataTypeMemoryCache]);
            WKWebsiteDataStore::defaultDataStore(main).removeDataOfTypes_modifiedSince_completionHandler(
                &caches,
                &NSDate::distantPast(),
                &RcBlock::new(|| {}),
            );
        }
    })?;
    Ok(())
}
