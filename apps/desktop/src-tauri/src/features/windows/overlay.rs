use crate::shared::lock::Lock;
use serde::de::DeserializeOwned;
use serde::Serialize;
use std::io::{BufRead, Write};
use std::process::{Child, ChildStdin, Command, Stdio};
use tauri::{AppHandle, LogicalPosition, LogicalSize, Manager, Monitor, Result, WebviewUrl, WebviewWindowBuilder};

const VOICE_OVERLAY: &str = "voice-overlay";
const PAGE: &str = "voice-overlay.html";
const CARD_WIDTH: f64 = 380.0;
const CARD_HEIGHT: f64 = 140.0;
const GAP: f64 = 12.0;

pub const OVERLAY_PROCESS_ARG: &str = "--voice-overlay";
/// Still runs this build after an update or rebuild replaces the file on disk.
const RUNNING_EXECUTABLE: &str = "/proc/self/exe";

/// The overlay drawn by a separate process through XWayland, because GNOME keeps only
/// X11 windows above the others.
#[derive(Default)]
pub struct OverlayProcess(Lock<Option<Child>>);

pub fn show_voice_overlay(app: &AppHandle, settings: &impl Serialize) -> Result<()> {
    if app.get_webview_window(VOICE_OVERLAY).is_some() || app.state::<OverlayProcess>().0.lock().is_some() {
        return Ok(());
    }
    if crate::shared::platform::on_wayland() && std::env::var_os("DISPLAY").is_some() {
        return spawn_overlay_process(app, settings);
    }
    build_voice_overlay(app)
}

pub fn build_voice_overlay(app: &AppHandle) -> Result<()> {
    let builder = WebviewWindowBuilder::new(app, VOICE_OVERLAY, WebviewUrl::App(PAGE.into()))
        .title("Voice note")
        .decorations(false)
        .always_on_top(true)
        .visible_on_all_workspaces(true)
        .skip_taskbar(true)
        .resizable(false)
        .focused(false)
        .focusable(false)
        .incognito(true);
    #[cfg(not(target_os = "macos"))]
    let builder = builder.transparent(true).shadow(false);
    let (width, height, top_gap) = if cfg!(target_os = "macos") {
        (CARD_WIDTH, CARD_HEIGHT, GAP)
    } else {
        (CARD_WIDTH + 2.0 * GAP, CARD_HEIGHT + GAP, 0.0)
    };
    let builder = builder.inner_size(width, height);
    let builder = match app.primary_monitor()?.map(|monitor| work_area(&monitor)) {
        Some((position, size)) => builder.position(position.x + (size.width - width) / 2.0, position.y + top_gap),
        None => builder.center(),
    };
    let window = builder.visible(false).build()?;
    let shown = window.clone();
    window.run_on_main_thread(move || {
        #[cfg(target_os = "linux")]
        mark_as_notification(&shown);
        let _ = shown.show();
        let _ = shown.set_ignore_cursor_events(true);
    })
}

/// Desktop extensions that restyle or tile windows, such as rounded corners with a
/// border and shadow, leave notifications alone.
#[cfg(target_os = "linux")]
fn mark_as_notification(window: &tauri::WebviewWindow) {
    use gtk::prelude::GtkWindowExt;
    if let Ok(gtk_window) = window.gtk_window() {
        gtk_window.set_type_hint(gtk::gdk::WindowTypeHint::Notification);
    }
}

fn spawn_overlay_process(app: &AppHandle, settings: &impl Serialize) -> Result<()> {
    let mut child = Command::new(RUNNING_EXECUTABLE)
        .arg(OVERLAY_PROCESS_ARG)
        .env("GDK_BACKEND", "x11")
        .env_remove("WAYLAND_DISPLAY")
        .stdin(Stdio::piped())
        .spawn()?;
    if let Some(stdin) = child.stdin.as_mut() {
        send_line(stdin, settings)?;
    }
    *app.state::<OverlayProcess>().0.lock() = Some(child);
    Ok(())
}

pub fn relay_to_overlay(app: &AppHandle, message: &impl Serialize) {
    let process = app.state::<OverlayProcess>();
    let mut child = process.0.lock();
    let Some(stdin) = child.as_mut().and_then(|child| child.stdin.as_mut()) else {
        return;
    };
    if send_line(stdin, message).is_err() {
        end_overlay_process(child.take());
    }
}

fn send_line(stdin: &mut ChildStdin, message: &impl Serialize) -> std::io::Result<()> {
    writeln!(stdin, "{}", serde_json::to_string(message)?)
}

pub fn read_from_parent<T: DeserializeOwned + Default>() -> T {
    let mut line = String::new();
    let _ = std::io::stdin().lock().read_line(&mut line);
    serde_json::from_str(&line).unwrap_or_default()
}

pub fn listen_to_parent<T: DeserializeOwned>(app: AppHandle, on_message: impl Fn(&AppHandle, T) + Send + 'static) {
    std::thread::spawn(move || {
        for line in std::io::stdin().lock().lines().map_while(std::result::Result::ok) {
            if let Ok(message) = serde_json::from_str(&line) {
                on_message(&app, message);
            }
        }
        app.exit(0);
    });
}

pub fn close_voice_overlay(app: &AppHandle) {
    end_overlay_process(app.state::<OverlayProcess>().0.lock().take());
    if let Some(window) = app.get_webview_window(VOICE_OVERLAY) {
        let _ = window.destroy();
    }
}

fn end_overlay_process(child: Option<Child>) {
    if let Some(mut child) = child {
        drop(child.stdin.take());
        std::thread::spawn(move || child.wait());
    }
}

fn work_area(monitor: &Monitor) -> (LogicalPosition<f64>, LogicalSize<f64>) {
    let area = monitor.work_area();
    let scale = monitor.scale_factor();
    (area.position.to_logical(scale), area.size.to_logical(scale))
}
