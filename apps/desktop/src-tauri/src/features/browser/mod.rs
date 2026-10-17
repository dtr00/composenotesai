#[cfg(target_os = "linux")]
mod cache_linux;
#[cfg(target_os = "macos")]
mod cache_macos;
#[cfg(windows)]
mod cache_windows;
mod hotkeys;
#[cfg(any(target_os = "macos", test))]
mod macos_key_names;
#[cfg(any(windows, test))]
mod windows_key_names;
#[cfg(target_os = "linux")]
mod keys_linux;
#[cfg(target_os = "macos")]
mod keys_macos;
#[cfg(windows)]
mod keys_windows;
#[cfg(target_os = "linux")]
mod overlay;

pub use hotkeys::{AppHotkeys, Binding};

use crate::shared::error::{Error, Result};
use crate::shared::web::is_http;
#[cfg(not(target_os = "macos"))]
use crate::shared::web_cache::clear_web_caches;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::webview::{NewWindowResponse, PageLoadEvent};
use tauri::{
    AppHandle, Emitter, EventTarget, LogicalPosition, LogicalSize, Manager, Url, Webview, WebviewBuilder, WebviewUrl,
    Window, Wry,
};

const LABEL_PREFIX: &str = "browser-";
const LOAD_EVENT: &str = "browser-load";
const TITLE_EVENT: &str = "browser-title";
const NEW_TAB_EVENT: &str = "browser-new-tab";
const HOTKEY_EVENT: &str = "browser-hotkey";
const STOP_SCRIPT: &str = "window.stop()";
const DATA_FOLDER: &str = "browser";

#[derive(Debug, Clone, Copy, Deserialize)]
pub struct Bounds {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

#[derive(Clone, Serialize)]
struct PageLoad {
    tab: u32,
    url: String,
    loading: bool,
}

#[derive(Clone, Serialize)]
struct PageTitle {
    tab: u32,
    url: String,
    title: String,
}

#[derive(Clone, Serialize)]
struct NewTab {
    url: String,
}

#[derive(Clone, Serialize)]
struct PressedHotkey {
    action: String,
}

fn window_prefix(window: &Window) -> String {
    format!("{LABEL_PREFIX}{}-", window.label())
}

fn label(window: &Window, tab: u32) -> String {
    format!("{}{tab}", window_prefix(window))
}

fn find(window: &Window, tab: u32) -> Option<Webview> {
    window.get_webview(&label(window, tab))
}

fn is_web_page(dev_url: Option<&Url>, url: &Url) -> bool {
    let custom_protocol = url.host_str().is_some_and(|host| host.ends_with(".localhost"));
    let dev_server = dev_url.is_some_and(|dev| dev.origin() == url.origin());
    is_http(url) && !custom_protocol && !dev_server
}

fn may_navigate(dev_url: Option<&Url>, url: &Url) -> bool {
    is_web_page(dev_url, url) || matches!(url.scheme(), "about" | "blob" | "data")
}

#[derive(Clone)]
struct Owner {
    app: AppHandle,
    window: String,
    dev_url: Option<Url>,
}

impl Owner {
    fn new(window: &Window) -> Self {
        let app = window.app_handle().clone();
        let dev_url = app.config().build.dev_url.clone();
        Self { app, window: window.label().to_owned(), dev_url }
    }

    fn web_page(&self, input: &str) -> Result<Url> {
        let page = Url::parse(input).ok().filter(|url| is_web_page(self.dev_url.as_ref(), url));
        page.ok_or_else(|| Error::Message("Only web pages can be opened in a browser tab.".into()))
    }

    fn emit<S: Serialize + Clone>(&self, event: &str, payload: S) {
        let _ = self.app.emit_to(EventTarget::webview_window(&self.window), event, payload);
    }
}

fn builder(window: &Window, owner: &Owner, tab: u32, url: Url) -> WebviewBuilder<Wry> {
    let (navigation, new_window, load, title) = (owner.clone(), owner.clone(), owner.clone(), owner.clone());
    identify(WebviewBuilder::new(label(window, tab), WebviewUrl::External(url)))
        .on_navigation(move |url| may_navigate(navigation.dev_url.as_ref(), url))
        .on_new_window(move |url, _| {
            if is_web_page(new_window.dev_url.as_ref(), &url) {
                new_window.emit(NEW_TAB_EVENT, NewTab { url: url.into() });
            }
            NewWindowResponse::Deny
        })
        .on_page_load(move |_, payload| {
            let loading = matches!(payload.event(), PageLoadEvent::Started);
            load.emit(LOAD_EVENT, PageLoad { tab, url: payload.url().to_string(), loading });
        })
        .on_document_title_changed(move |view, text| {
            if let Ok(url) = view.url() {
                title.emit(TITLE_EVENT, PageTitle { tab, url: url.into(), title: text });
            }
        })
}

// WebView2 already sends Edge's user agent, which Google accepts.
#[cfg(not(target_os = "windows"))]
fn identify(builder: WebviewBuilder<Wry>) -> WebviewBuilder<Wry> {
    builder.user_agent(crate::shared::web::SAFARI_USER_AGENT)
}

#[cfg(target_os = "windows")]
fn identify(builder: WebviewBuilder<Wry>) -> WebviewBuilder<Wry> {
    builder
}

#[cfg(target_os = "linux")]
use keys_linux::forward_app_hotkeys;
#[cfg(target_os = "macos")]
use keys_macos::forward_app_hotkeys;
#[cfg(windows)]
use keys_windows::forward_app_hotkeys;
#[cfg(target_os = "linux")]
use overlay::{dock, place};
#[cfg(target_os = "linux")]
use cache_linux::clear_view_cache;
#[cfg(target_os = "macos")]
pub use cache_macos::clear_cache;
#[cfg(windows)]
use cache_windows::clear_view_cache;

#[cfg(not(target_os = "linux"))]
fn dock(_: &Webview, _: Bounds) -> Result<()> {
    Ok(())
}

#[cfg(not(target_os = "linux"))]
fn place(view: &Webview, bounds: Bounds) -> Result<()> {
    view.set_bounds(tauri::Rect {
        position: LogicalPosition::new(bounds.x, bounds.y).into(),
        size: LogicalSize::new(bounds.width, bounds.height).into(),
    })?;
    Ok(())
}

pub fn data_directory(app: &AppHandle) -> Result<PathBuf> {
    Ok(app.path().app_data_dir()?.join(DATA_FOLDER))
}

fn create(window: &Window, owner: Owner, tab: u32, url: Url, bounds: Bounds) -> Result<()> {
    let data = data_directory(window.app_handle())?;
    let view = window.add_child(
        builder(window, &owner, tab, url).data_directory(data),
        LogicalPosition::new(bounds.x, bounds.y),
        LogicalSize::new(bounds.width, bounds.height),
    )?;
    dock(&view, bounds)?;
    forward_app_hotkeys(&view, owner)
}

pub fn show(window: &Window, tab: u32, url: Option<&str>, bounds: Bounds) -> Result<()> {
    let owner = Owner::new(window);
    let url = url.map(|input| owner.web_page(input)).transpose()?;
    match (find(window, tab), url) {
        (Some(view), url) => {
            if let Some(url) = url {
                view.navigate(url)?;
            }
            place(&view, bounds)?;
            view.show()?;
        }
        (None, Some(url)) => create(window, owner, tab, url, bounds)?,
        (None, None) => {}
    }
    Ok(())
}

pub fn set_bounds(window: &Window, tab: u32, bounds: Bounds) -> Result<()> {
    find(window, tab).map_or(Ok(()), |view| place(&view, bounds))
}

fn with_view(
    window: &Window,
    tab: u32,
    act: impl FnOnce(&Webview) -> tauri::Result<()>,
) -> Result<()> {
    if let Some(view) = find(window, tab) {
        act(&view)?;
    }
    Ok(())
}

fn focus_app(window: &Window) -> tauri::Result<()> {
    window.get_webview(window.label()).map_or(Ok(()), |app| app.set_focus())
}

pub fn hide(window: &Window, tab: u32) -> Result<()> {
    with_view(window, tab, |view| {
        view.hide()?;
        focus_app(window)
    })
}

pub fn reload(window: &Window, tab: u32) -> Result<()> {
    with_view(window, tab, Webview::reload)
}

pub fn stop(window: &Window, tab: u32) -> Result<()> {
    with_view(window, tab, |view| view.eval(STOP_SCRIPT))
}

pub fn close(window: &Window, tab: u32) -> Result<()> {
    with_view(window, tab, |view| {
        view.close()?;
        focus_app(window)
    })
}

#[cfg(not(target_os = "macos"))]
pub fn clear_cache(app: &AppHandle) -> Result<()> {
    match app.webviews().into_values().find(|view| view.label().starts_with(LABEL_PREFIX)) {
        Some(view) => clear_view_cache(&view),
        None => {
            clear_web_caches(&[data_directory(app)?]);
            Ok(())
        }
    }
}

pub fn close_all(window: &Window) -> Result<()> {
    let prefix = window_prefix(window);
    for view in window.webviews().into_iter().filter(|view| view.label().starts_with(&prefix)) {
        view.close()?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn url(input: &str) -> Url {
        Url::parse(input).unwrap()
    }

    #[test]
    fn only_outside_web_pages_are_browsable() {
        let dev = url("http://localhost:1420");
        assert!(is_web_page(Some(&dev), &url("https://example.com/a?b=1")));
        assert!(is_web_page(Some(&dev), &url("http://localhost:3000/")));
        assert!(!is_web_page(Some(&dev), &url("http://localhost:1420/#/notes/1")));
        assert!(!is_web_page(None, &url("http://tauri.localhost/")));
        assert!(!is_web_page(None, &url("tauri://localhost/")));
        assert!(!is_web_page(None, &url("file:///etc/passwd")));
        assert!(!is_web_page(None, &url("javascript:alert(1)")));
    }

    #[test]
    fn pages_may_open_blank_and_inline_documents() {
        assert!(may_navigate(None, &url("about:blank")));
        assert!(may_navigate(None, &url("blob:https://example.com/1")));
        assert!(!may_navigate(None, &url("ipc://localhost/")));
        assert!(!may_navigate(None, &url("https://asset.localhost/x")));
    }
}
