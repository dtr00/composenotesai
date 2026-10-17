use super::binding::Binding;
use super::hotkey::Hotkey;
use super::plugin;
#[cfg(target_os = "linux")]
use super::{gnome, portal};
use crate::shared::error::{Error, Result};
use crate::shared::lock::Lock;
use serde::Serialize;
use std::collections::HashMap;
use std::sync::mpsc::{channel, Sender};
use std::time::{Duration, Instant};
use tauri::{App, AppHandle, Emitter, Manager};

const REPEAT_GAP: Duration = Duration::from_millis(400);
const VOICE_SHORTCUTS_CHANGED: &str = "voice-shortcuts-changed";

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum ShortcutEvent {
    Record,
    ReleaseRecord,
    Cancel,
}

pub type OnShortcut = fn(&AppHandle, ShortcutEvent);

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum Backend {
    Plugin,
    #[cfg(target_os = "linux")]
    Portal,
}

impl Backend {
    fn detect() -> Self {
        #[cfg(target_os = "linux")]
        if crate::shared::platform::on_wayland() {
            return Backend::Portal;
        }
        Backend::Plugin
    }
}

#[derive(Clone, Default)]
struct Bound {
    hotkey: Option<Hotkey>,
    description: Option<String>,
}

#[derive(Default)]
struct Current {
    record: Bound,
    cancel: Bound,
    set_up: bool,
}

impl Current {
    fn bound(&mut self, binding: Binding) -> &mut Bound {
        match binding {
            Binding::Record => &mut self.record,
            Binding::Cancel => &mut self.cancel,
        }
    }
}

pub struct VoiceShortcuts {
    backend: Backend,
    current: Lock<Current>,
    last_pressed: Lock<HashMap<ShortcutEvent, Instant>>,
    queue: Sender<ShortcutEvent>,
}

impl VoiceShortcuts {
    fn is_new_press(&self, event: ShortcutEvent, now: Instant) -> bool {
        let mut last_pressed = self.last_pressed.lock();
        let previous = last_pressed.insert(event, now);
        previous.is_none_or(|previous| now.duration_since(previous) >= REPEAT_GAP)
    }

    pub(super) fn hotkey(&self, binding: Binding) -> Option<Hotkey> {
        self.current.lock().bound(binding).hotkey.clone()
    }

    pub(super) fn remember(&self, binding: Binding, hotkey: Option<Hotkey>, description: Option<String>) {
        let mut current = self.current.lock();
        *current.bound(binding) = Bound { hotkey, description };
        current.set_up = true;
    }

    #[cfg(target_os = "linux")]
    pub(super) fn reset(&self) {
        *self.current.lock() = Current::default();
    }
}

#[derive(Clone, Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BindingInfo {
    pub hotkey: Option<String>,
    pub description: Option<String>,
    pub default_hotkey: String,
}

#[derive(Clone, Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ShortcutInfo {
    pub record: BindingInfo,
    pub cancel: BindingInfo,
    pub editable: bool,
    pub needs_setup: bool,
}

pub(super) fn fire(app: &AppHandle, event: ShortcutEvent) {
    if app.state::<VoiceShortcuts>().is_new_press(event, Instant::now()) {
        run(app, event);
    }
}

pub(super) fn run(app: &AppHandle, event: ShortcutEvent) {
    let _ = app.state::<VoiceShortcuts>().queue.send(event);
}

fn run_in_order(app: AppHandle, on_shortcut: OnShortcut) -> Sender<ShortcutEvent> {
    let (queue, events) = channel();
    std::thread::spawn(move || {
        for event in events {
            on_shortcut(&app, event);
        }
    });
    queue
}

pub(super) fn announce_changed(app: &AppHandle) {
    let _ = app.emit(VOICE_SHORTCUTS_CHANGED, info(app));
}

pub fn register(
    app: &App,
    on_shortcut: OnShortcut,
    record: Option<&str>,
    cancel: Option<&str>,
    set_up: bool,
) -> tauri::Result<()> {
    let backend = Backend::detect();
    let chosen = |binding: Binding, saved: Option<&str>| {
        let saved = saved.and_then(|text| binding.parse(text, backend).ok());
        Bound { hotkey: Some(saved.unwrap_or_else(|| binding.default_hotkey(backend))), description: None }
    };
    let current =
        Current { record: chosen(Binding::Record, record), cancel: chosen(Binding::Cancel, cancel), set_up: false };
    let queue = run_in_order(app.handle().clone(), on_shortcut);
    app.manage(VoiceShortcuts { backend, current: Lock::new(current), last_pressed: Lock::default(), queue });
    match backend {
        Backend::Plugin => plugin::start(app.handle()),
        #[cfg(target_os = "linux")]
        Backend::Portal => {
            portal::start(app.handle().clone(), set_up);
            Ok(())
        }
    }
}

pub fn grab_cancel(app: &AppHandle) {
    match app.state::<VoiceShortcuts>().backend {
        Backend::Plugin => plugin::grab_cancel(app),
        #[cfg(target_os = "linux")]
        Backend::Portal => {}
    }
}

pub fn release_cancel(app: &AppHandle) {
    match app.state::<VoiceShortcuts>().backend {
        Backend::Plugin => plugin::release_cancel(app),
        #[cfg(target_os = "linux")]
        Backend::Portal => {}
    }
}

pub async fn change(app: &AppHandle, binding: Binding, hotkey: Option<&str>) -> Result<()> {
    let state = app.state::<VoiceShortcuts>();
    let backend = state.backend;
    let hotkey = match hotkey {
        Some(text) => binding.parse(text, backend)?,
        None => binding.default_hotkey(backend),
    };
    let previous = state.hotkey(binding);
    if previous.as_ref() == Some(&hotkey) {
        return Ok(());
    }
    if state.hotkey(binding.other()).as_ref() == Some(&hotkey) {
        return Err(Error::Message(format!("That shortcut already {}.", binding.other().purpose())));
    }
    match backend {
        Backend::Plugin => plugin::change(app, binding, previous.as_ref(), &hotkey),
        #[cfg(target_os = "linux")]
        Backend::Portal => portal::change(app, binding, &hotkey).await,
    }
}

pub async fn set_up(app: &AppHandle) -> Result<()> {
    match app.state::<VoiceShortcuts>().backend {
        Backend::Plugin => Ok(()),
        #[cfg(target_os = "linux")]
        Backend::Portal => portal::set_up(app.clone()).await,
    }
}

pub fn hotkey(app: &AppHandle, binding: Binding) -> Option<String> {
    app.state::<VoiceShortcuts>().hotkey(binding).map(|hotkey| hotkey.to_string())
}

pub fn info(app: &AppHandle) -> ShortcutInfo {
    let state = app.state::<VoiceShortcuts>();
    let backend = state.backend;
    let (editable, portal) = match backend {
        Backend::Plugin => (true, false),
        #[cfg(target_os = "linux")]
        Backend::Portal => (gnome::available(), true),
    };
    let mut current = state.current.lock();
    let mut describe = |binding: Binding| {
        let Bound { hotkey, description } = current.bound(binding).clone();
        let hotkey = hotkey.map(|hotkey| hotkey.to_string());
        BindingInfo { hotkey, description, default_hotkey: binding.default_hotkey(backend).to_string() }
    };
    let (record, cancel) = (describe(Binding::Record), describe(Binding::Cancel));
    ShortcutInfo { record, cancel, editable, needs_setup: portal && !current.set_up }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn shortcut_state() -> VoiceShortcuts {
        VoiceShortcuts {
            backend: Backend::Plugin,
            current: Lock::default(),
            last_pressed: Lock::default(),
            queue: channel().0,
        }
    }

    fn hotkey(text: &str) -> Hotkey {
        Hotkey::parse(text).unwrap()
    }

    #[test]
    fn a_burst_of_repeats_counts_as_one_press() {
        let state = shortcut_state();
        let start = Instant::now();
        let presses: Vec<bool> = (0..9)
            .map(|i| state.is_new_press(ShortcutEvent::Record, start + Duration::from_millis(30 * i)))
            .collect();
        assert_eq!(presses.iter().filter(|new| **new).count(), 1);
        assert!(presses[0]);
    }

    #[test]
    fn a_press_after_a_quiet_gap_counts_again() {
        let state = shortcut_state();
        let start = Instant::now();
        assert!(state.is_new_press(ShortcutEvent::Record, start));
        assert!(state.is_new_press(ShortcutEvent::Record, start + REPEAT_GAP));
    }

    #[test]
    fn different_shortcuts_do_not_share_a_burst() {
        let state = shortcut_state();
        let now = Instant::now();
        assert!(state.is_new_press(ShortcutEvent::Record, now));
        assert!(state.is_new_press(ShortcutEvent::Cancel, now));
    }

    #[test]
    fn remembering_one_binding_keeps_the_other() {
        let state = shortcut_state();
        state.remember(Binding::Record, Some(hotkey("mod+alt+r")), None);
        state.remember(Binding::Cancel, Some(hotkey("Escape")), None);
        state.remember(Binding::Record, Some(hotkey("mod+shift+v")), None);
        assert_eq!(state.hotkey(Binding::Record), Some(hotkey("mod+shift+v")));
        assert_eq!(state.hotkey(Binding::Cancel), Some(hotkey("Escape")));
    }

    #[test]
    #[cfg(target_os = "linux")]
    fn a_failed_portal_connection_clears_the_saved_setup_state() {
        let state = shortcut_state();
        state.remember(Binding::Record, Some(hotkey("mod+alt+r")), None);
        state.remember(Binding::Cancel, Some(hotkey("mod+alt+c")), None);
        state.reset();
        assert!(!state.current.lock().set_up);
        assert_eq!(state.hotkey(Binding::Record), None);
        assert_eq!(state.hotkey(Binding::Cancel), None);
    }
}
