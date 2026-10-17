use crate::shared::error::Result;
use tauri::Webview;
use webview2_com::ClearBrowsingDataCompletedHandler;
use webview2_com::Microsoft::Web::WebView2::Win32::{
    ICoreWebView2Profile2, ICoreWebView2_13, COREWEBVIEW2_BROWSING_DATA_KINDS_DISK_CACHE,
};
use windows::core::Interface;

pub fn clear_view_cache(view: &Webview) -> Result<()> {
    view.with_webview(|platform| {
        let handler = ClearBrowsingDataCompletedHandler::create(Box::new(|cleared| {
            if let Err(error) = cleared {
                eprintln!("[browser] couldn't clear the cache: {error}");
            }
            Ok(())
        }));
        let started = unsafe {
            platform
                .controller()
                .CoreWebView2()
                .and_then(|page| page.cast::<ICoreWebView2_13>()?.Profile())
                .and_then(|profile| profile.cast::<ICoreWebView2Profile2>())
                .and_then(|profile| profile.ClearBrowsingData(COREWEBVIEW2_BROWSING_DATA_KINDS_DISK_CACHE, &handler))
        };
        if let Err(error) = started {
            eprintln!("[browser] couldn't clear the cache: {error}");
        }
    })?;
    Ok(())
}
