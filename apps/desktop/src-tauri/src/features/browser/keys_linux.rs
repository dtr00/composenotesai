use super::hotkeys::{AppHotkeys, Hotkey};
use super::{Owner, PressedHotkey, HOTKEY_EVENT};
use crate::shared::error::Result;
use gtk::gdk::{self, ModifierType};
use gtk::glib::Propagation;
use gtk::prelude::*;
use std::cell::Cell;
use std::rc::Rc;
use tauri::{Manager, Webview};

const NAMED_KEYS: &[(&str, &str)] = &[
    ("Return", "Enter"),
    ("KP_Enter", "Enter"),
    ("Escape", "Escape"),
    ("Tab", "Tab"),
    ("ISO_Left_Tab", "Tab"),
    ("BackSpace", "Backspace"),
    ("Delete", "Delete"),
    ("KP_Delete", "Delete"),
    ("Insert", "Insert"),
    ("Home", "Home"),
    ("End", "End"),
    ("Page_Up", "PageUp"),
    ("Page_Down", "PageDown"),
    ("Left", "ArrowLeft"),
    ("Right", "ArrowRight"),
    ("Up", "ArrowUp"),
    ("Down", "ArrowDown"),
    ("space", "space"),
];

fn is_function_key(name: &str) -> bool {
    let number = name.strip_prefix('F').and_then(|number| number.parse::<u8>().ok());
    number.is_some_and(|number| (1..=24).contains(&number))
}

fn key_name(name: &str, character: Option<char>, base: Option<char>, shift: bool) -> Option<String> {
    if let Some((_, key)) = NAMED_KEYS.iter().find(|(gdk_name, _)| *gdk_name == name) {
        return Some((*key).to_owned());
    }
    if is_function_key(name) {
        return Some(name.to_owned());
    }
    let base = base.filter(char::is_ascii_alphanumeric).map(|base| base.to_ascii_lowercase().to_string());
    if name.starts_with("dead_") {
        return base;
    }
    if shift && base.as_deref().is_some_and(|base| base.chars().all(|c| c.is_ascii_digit())) {
        return base;
    }
    character.filter(|c| !c.is_control()).map(|c| c.to_lowercase().collect())
}

fn base_character(event: &gdk::EventKey) -> Option<char> {
    let keymap = gdk::Display::default().and_then(|display| gdk::Keymap::for_display(&display))?;
    let (keyval, ..) = keymap.translate_keyboard_state(
        u32::from(event.hardware_keycode()),
        ModifierType::empty(),
        i32::from(event.group()),
    )?;
    gdk::keys::Key::from(keyval).to_unicode()
}

fn pressed(event: &gdk::EventKey) -> Option<Hotkey> {
    let state = event.state();
    if state.intersects(ModifierType::SUPER_MASK | ModifierType::META_MASK) {
        return None;
    }
    let keyval = event.keyval();
    let shift = state.contains(ModifierType::SHIFT_MASK);
    let key = key_name(&keyval.name()?, keyval.to_unicode(), base_character(event), shift)?;
    let (primary, alt) = (state.contains(ModifierType::CONTROL_MASK), state.contains(ModifierType::MOD1_MASK));
    Some(Hotkey { key, primary, alt, shift })
}

pub fn forward_app_hotkeys(view: &Webview, owner: Owner) -> Result<()> {
    view.with_webview(move |platform| {
        let page = platform.inner().upcast::<gtk::Widget>();
        let held = Rc::new(Cell::new(None));
        let (released, blurred) = (Rc::clone(&held), Rc::clone(&held));
        page.connect_key_press_event(move |_, event| {
            let Some(action) = pressed(event).and_then(|hotkey| owner.app.state::<AppHotkeys>().action(&hotkey)) else {
                return Propagation::Proceed;
            };
            if held.replace(Some(event.hardware_keycode())) != Some(event.hardware_keycode()) {
                owner.emit(HOTKEY_EVENT, PressedHotkey { action });
            }
            Propagation::Stop
        });
        page.connect_key_release_event(move |_, _| {
            released.set(None);
            Propagation::Proceed
        });
        page.connect_focus_out_event(move |_, _| {
            blurred.set(None);
            Propagation::Proceed
        });
    })?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keys_are_named_like_the_frontend_names_them() {
        assert_eq!(key_name("t", Some('t'), Some('t'), false).as_deref(), Some("t"));
        assert_eq!(key_name("T", Some('T'), Some('t'), true).as_deref(), Some("t"));
        assert_eq!(key_name("comma", Some(','), Some(','), false).as_deref(), Some(","));
        assert_eq!(key_name("less", Some('<'), Some(','), true).as_deref(), Some("<"));
        assert_eq!(key_name("exclam", Some('!'), Some('1'), true).as_deref(), Some("1"));
        assert_eq!(key_name("dead_acute", None, Some('e'), false).as_deref(), Some("e"));
        assert_eq!(key_name("Return", Some('\r'), None, false).as_deref(), Some("Enter"));
        assert_eq!(key_name("space", Some(' '), Some(' '), false).as_deref(), Some("space"));
        assert_eq!(key_name("F5", None, None, false).as_deref(), Some("F5"));
        assert_eq!(key_name("Left", None, None, false).as_deref(), Some("ArrowLeft"));
        assert_eq!(key_name("Control_L", None, None, false), None);
        assert_eq!(key_name("F25", None, None, false), None);
    }
}
