use super::held_key::KeyRepeat;
use super::hotkey::Hotkey;
use crate::shared::error::{Error, Result};
use gtk::gio::{self, prelude::SettingsExt};
use gtk::glib::{variant::ToVariant, Variant};
use std::collections::HashMap;
use std::time::Duration;

const APPLICATIONS_SCHEMA: &str = "org.gnome.settings-daemon.global-shortcuts";
const APPLICATION_SCHEMA: &str = "org.gnome.settings-daemon.global-shortcuts.application";
const PATH: &str = "/org/gnome/settings-daemon/global-shortcuts/";
const KEYBOARD_SCHEMA: &str = "org.gnome.desktop.peripherals.keyboard";
type Bindings = Vec<(String, HashMap<String, Variant>)>;

pub fn available() -> bool {
    std::env::var("XDG_CURRENT_DESKTOP").unwrap_or_default().split(':').any(|name| name.eq_ignore_ascii_case("GNOME"))
        && schema(APPLICATIONS_SCHEMA).is_some()
        && schema(APPLICATION_SCHEMA).is_some()
}

pub fn key_repeat() -> Option<KeyRepeat> {
    let keyboard = gio::Settings::new_full(&schema(KEYBOARD_SCHEMA)?, gio::SettingsBackend::NONE, None::<&str>);
    let millis = |key| Duration::from_millis(keyboard.uint(key).into());
    keyboard.boolean("repeat").then(|| KeyRepeat { delay: millis("delay"), interval: millis("repeat-interval") })
}

fn schema(id: &str) -> Option<gio::SettingsSchema> {
    gio::SettingsSchemaSource::default()?.lookup(id, true)
}

fn settings(schema_id: &str, path: &str) -> Result<gio::Settings> {
    let schema =
        schema(schema_id).ok_or_else(|| Error::Message("GNOME shortcut settings aren't available.".into()))?;
    Ok(gio::Settings::new_full(&schema, gio::SettingsBackend::NONE, Some(path)))
}

fn replace(bindings: &Variant, shortcut_id: &str, hotkey: &Hotkey) -> Result<Option<Bindings>> {
    let mut bindings =
        bindings.get::<Bindings>().ok_or_else(|| Error::Message("Couldn't read GNOME shortcuts.".into()))?;
    let Some((_, properties)) = bindings.iter_mut().find(|(id, _)| id == shortcut_id) else {
        return Ok(None);
    };
    properties.insert("shortcuts".into(), vec![hotkey.to_gnome()].to_variant());
    Ok(Some(bindings))
}

fn app_settings(app_id: &str) -> Result<gio::Settings> {
    settings(APPLICATION_SCHEMA, &format!("{PATH}{app_id}/"))
}

pub struct Previous {
    app_id: String,
    shortcuts: Variant,
}

impl Previous {
    pub fn restore(self) {
        if let Ok(app) = app_settings(&self.app_id) {
            let _ = app.set_value("shortcuts", &self.shortcuts);
        }
        gio::Settings::sync();
    }
}

pub fn set(app_id: &str, shortcut_id: &str, hotkey: &Hotkey) -> Result<Previous> {
    let app = app_settings(app_id)?;
    let shortcuts = app.value("shortcuts");
    let Some(bindings) = replace(&shortcuts, shortcut_id, hotkey)? else {
        return Err(Error::Message("Set up the shortcuts before changing them.".into()));
    };
    app.set_value("shortcuts", &bindings.to_variant())
        .map_err(|e| Error::Message(format!("Couldn't save the GNOME shortcut. ({e})")))?;
    gio::Settings::sync();
    Ok(Previous { app_id: app_id.to_owned(), shortcuts })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn hotkey(text: &str) -> Hotkey {
        Hotkey::parse(text).unwrap()
    }

    fn bindings() -> Bindings {
        vec![
            (
                "record-voice-note".into(),
                HashMap::from([
                    ("description".into(), "Record a voice note".to_variant()),
                    ("shortcuts".into(), vec!["<Control><Alt>r"].to_variant()),
                ]),
            ),
            ("cancel-voice-note".into(), HashMap::from([("shortcuts".into(), vec!["<Control><Alt>c"].to_variant())])),
        ]
    }

    #[test]
    fn rebinding_preserves_other_shortcuts_and_properties() {
        let original = bindings();
        let rebound = hotkey("mod+shift+ArrowUp");
        let updated = replace(&original.to_variant(), "record-voice-note", &rebound).unwrap().unwrap();
        assert_eq!(updated[1], original[1]);
        assert_eq!(updated[0].1["description"], original[0].1["description"]);
        assert_eq!(updated[0].1["shortcuts"].get::<Vec<String>>().unwrap(), ["<Control><Shift>Up"]);
    }

    #[test]
    fn apps_without_the_shortcut_are_left_alone() {
        assert!(replace(&bindings().to_variant(), "something-else", &hotkey("alt+r")).unwrap().is_none());
    }
}
