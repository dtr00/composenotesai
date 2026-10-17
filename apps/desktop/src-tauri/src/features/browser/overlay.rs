// Tauri packs child webviews into the window's GtkBox, which ignores their bounds, so on
// Linux the browser floats in a GtkOverlay above the app webview instead.

use super::Bounds;
use crate::shared::error::Result;
use gtk::prelude::*;
use tauri::Webview;

fn wrap_app(vbox: &gtk::Box, browser: &gtk::Widget) -> gtk::Overlay {
    let overlay = gtk::Overlay::new();
    if let Some(app) = vbox.children().into_iter().find(|child| child != browser) {
        vbox.remove(&app);
        overlay.add(&app);
    }
    vbox.pack_start(&overlay, true, true, 0);
    overlay.show();
    overlay
}

fn float(browser: &gtk::Widget) {
    let Some(vbox) = browser.parent().and_then(|parent| parent.downcast::<gtk::Box>().ok()) else {
        return;
    };
    let overlay = vbox
        .children()
        .into_iter()
        .find_map(|child| child.downcast::<gtk::Overlay>().ok())
        .unwrap_or_else(|| wrap_app(&vbox, browser));
    let focused = browser.is_focus();
    vbox.remove(browser);
    browser.set_halign(gtk::Align::Start);
    browser.set_valign(gtk::Align::Start);
    overlay.add_overlay(browser);
    if focused {
        browser.grab_focus();
    }
}

fn resize(browser: &gtk::Widget, bounds: Bounds) {
    browser.set_margin_start(bounds.x.round() as i32);
    browser.set_margin_top(bounds.y.round() as i32);
    browser.set_size_request(bounds.width.round() as i32, bounds.height.round() as i32);
}

pub fn dock(view: &Webview, bounds: Bounds) -> Result<()> {
    view.with_webview(move |platform| {
        let browser = platform.inner().upcast::<gtk::Widget>();
        float(&browser);
        resize(&browser, bounds);
    })?;
    Ok(())
}

pub fn place(view: &Webview, bounds: Bounds) -> Result<()> {
    view.with_webview(move |platform| resize(&platform.inner().upcast::<gtk::Widget>(), bounds))?;
    Ok(())
}
