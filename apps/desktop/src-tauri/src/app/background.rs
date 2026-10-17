use crate::features::ai::Engine;
use crate::features::voice::{Recorder, Transcriber};
use crate::features::windows::app_in_front;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;
use tauri::{AppHandle, Manager, Runtime, Window, WindowEvent};

const CHECK_EVERY: Duration = Duration::from_secs(15);

static FOCUS_CHANGES: AtomicU64 = AtomicU64::new(0);

pub fn offload_models_in_background<R: Runtime>(window: &Window<R>, event: &WindowEvent) {
    match event {
        WindowEvent::Focused(true) => {
            FOCUS_CHANGES.fetch_add(1, Ordering::Relaxed);
        }
        WindowEvent::Focused(false) | WindowEvent::CloseRequested { .. } => {
            watch(window.app_handle().clone(), FOCUS_CHANGES.fetch_add(1, Ordering::Relaxed) + 1);
        }
        _ => {}
    }
}

pub fn watch_from_start<R: Runtime>(app: &AppHandle<R>) {
    watch(app.clone(), FOCUS_CHANGES.load(Ordering::Relaxed));
}

fn watch<R: Runtime>(app: AppHandle<R>, change: u64) {
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(CHECK_EVERY).await;
            if FOCUS_CHANGES.load(Ordering::Relaxed) != change || app_in_front(&app) {
                return;
            }
            app.state::<Engine>().stop_if_unused();
            if !app.state::<Recorder>().is_recording() {
                app.state::<Transcriber>().unload();
            }
        }
    });
}
