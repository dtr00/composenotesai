use std::sync::atomic::{AtomicU32, Ordering};
use tauri::{Manager, Result, Runtime, WebviewUrl, WebviewWindow, WebviewWindowBuilder, Window, WindowEvent};

const MAIN_WINDOW: &str = "main";
const WINDOW_LABEL_PREFIX: &str = "window-";

static NEXT_WINDOW: AtomicU32 = AtomicU32::new(1);

fn create_window<R: Runtime, M: Manager<R>>(manager: &M, label: &str, url: WebviewUrl) -> Result<WebviewWindow<R>> {
    let builder = WebviewWindowBuilder::new(manager, label, url)
        .title(&manager.package_info().name)
        .inner_size(1200.0, 800.0)
        .min_inner_size(640.0, 420.0);
    #[cfg(target_os = "macos")]
    let builder = builder
        .title_bar_style(tauri::TitleBarStyle::Overlay)
        .hidden_title(true)
        .traffic_light_position(tauri::LogicalPosition::new(12.0, 10.0));
    #[cfg(not(target_os = "macos"))]
    let builder = builder.decorations(false);
    let window = builder.build()?;
    #[cfg(target_os = "linux")]
    window.with_webview(|platform| {
        use gtk::prelude::Cast;
        super::edge_resize::resize_from_edges(&platform.inner().upcast());
    })?;
    Ok(window)
}

pub fn create_main_window<R: Runtime, M: Manager<R>>(manager: &M) -> Result<WebviewWindow<R>> {
    create_window(manager, MAIN_WINDOW, WebviewUrl::default())
}

pub fn is_main_window<R: Runtime>(window: &WebviewWindow<R>) -> bool {
    window.label() == MAIN_WINDOW
}

pub fn open_window<R: Runtime, M: Manager<R>>(manager: &M, path: &str) -> Result<WebviewWindow<R>> {
    let label = format!("{WINDOW_LABEL_PREFIX}{}", NEXT_WINDOW.fetch_add(1, Ordering::Relaxed));
    create_window(manager, &label, WebviewUrl::App(format!("#{path}").into()))
}

fn in_front<R: Runtime>(window: &Window<R>) -> bool {
    window.is_visible().unwrap_or(false) && window.is_focused().unwrap_or(false)
}

pub fn main_window_in_front<R: Runtime, M: Manager<R>>(manager: &M) -> bool {
    manager.get_window(MAIN_WINDOW).is_some_and(|window| in_front(&window))
}

pub fn app_in_front<R: Runtime, M: Manager<R>>(manager: &M) -> bool {
    manager.windows().values().any(in_front)
}

pub fn show_main_window<R: Runtime, M: Manager<R>>(manager: &M) {
    if let Some(window) = manager.get_webview_window(MAIN_WINDOW) {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

pub fn keep_main_window_alive<R: Runtime>(window: &Window<R>, event: &WindowEvent) {
    if window.label() != MAIN_WINDOW {
        return;
    }
    if let WindowEvent::CloseRequested { api, .. } = event {
        api.prevent_close();
        let _ = window.hide();
    }
}
