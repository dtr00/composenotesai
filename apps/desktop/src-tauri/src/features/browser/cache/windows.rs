use super::{browser_tab, clear_from_disk, Done};
use crate::shared::error::Result;
use std::cell::Cell;
use std::rc::Rc;
use tauri::AppHandle;
use webview2_com::ClearBrowsingDataCompletedHandler;
use webview2_com::Microsoft::Web::WebView2::Win32::{
    ICoreWebView2Profile2, ICoreWebView2_13, COREWEBVIEW2_BROWSING_DATA_KINDS_DISK_CACHE,
};
use windows::core::Interface;

fn report(done: &Cell<Option<Done>>, cleared: windows::core::Result<()>) {
    if let Some(done) = done.take() {
        let _ = done.send(cleared.map_err(|error| error.to_string()));
    }
}

pub fn start_clearing(app: &AppHandle, done: Done) -> Result<()> {
    let Some(view) = browser_tab(app) else { return clear_from_disk(app, done) };
    view.with_webview(move |platform| {
        let done = Rc::new(Cell::new(Some(done)));
        let finished = Rc::clone(&done);
        let handler = ClearBrowsingDataCompletedHandler::create(Box::new(move |cleared| {
            report(&finished, cleared);
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
            report(&done, Err(error));
        }
    })?;
    Ok(())
}
