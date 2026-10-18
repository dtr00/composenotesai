use crate::features::settings::Settings;
use crate::features::voice::{VoiceEvent, VoiceNote};
use crate::features::windows;
use tauri::{AppHandle, Manager, State};

pub struct ParentSettings(Settings);

impl ParentSettings {
    pub fn from_parent() -> Self {
        Self(windows::read_from_parent())
    }
}

pub fn relay_from_parent(app: AppHandle) {
    windows::listen_to_parent(app, |app, event: VoiceEvent| {
        app.state::<VoiceNote>().apply(&event);
        let _ = event.emit(app);
    });
}

#[tauri::command(rename = "load_settings")]
pub fn parent_settings(settings: State<ParentSettings>) -> Settings {
    settings.0.clone()
}

#[tauri::command]
pub fn resize_voice_overlay(window: tauri::WebviewWindow, height: f64) -> tauri::Result<()> {
    windows::resize_voice_overlay(&window, height)
}
