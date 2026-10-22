use super::binding::Binding;
use super::hotkey::Hotkey;
use super::shortcuts::{fire, run, ShortcutEvent, VoiceShortcuts};
use crate::shared::error::{Error, Result};
use tauri::{AppHandle, Manager};
use tauri_plugin_global_shortcut::{Builder, GlobalShortcutExt, ShortcutState};

const IN_USE: &str = "In use by another app";

pub(super) fn start(app: &AppHandle) -> tauri::Result<()> {
    app.plugin(Builder::new().build())?;
    if let Some(record) = app.state::<VoiceShortcuts>().hotkey(Binding::Record) {
        if let Err(e) = bind_record(app, None, &record) {
            eprintln!("[voice shortcuts] couldn't register {record}: {e}");
            app.state::<VoiceShortcuts>().remember(Binding::Record, None, Some(IN_USE.into()));
        }
    }
    Ok(())
}

fn bind_record(app: &AppHandle, previous: Option<&Hotkey>, hotkey: &Hotkey) -> Result<()> {
    if let Some(previous) = previous {
        app.global_shortcut()
            .unregister(previous.to_accelerator().as_str())
            .map_err(|e| Error::Message(e.to_string()))?;
    }
    listen(app, &hotkey.to_accelerator(), ShortcutEvent::Record, Some(ShortcutEvent::ReleaseRecord)).map_err(|e| {
        Error::Message(format!("Couldn't use that shortcut. Another app may already be using it. ({e})"))
    })?;
    app.state::<VoiceShortcuts>().remember(Binding::Record, Some(hotkey.clone()), None);
    Ok(())
}

fn listen(
    app: &AppHandle,
    accelerator: &str,
    on_press: ShortcutEvent,
    on_release: Option<ShortcutEvent>,
) -> std::result::Result<(), tauri_plugin_global_shortcut::Error> {
    app.global_shortcut().on_shortcut(accelerator, move |app, _, event| match event.state() {
        ShortcutState::Pressed => fire(app, on_press),
        ShortcutState::Released => {
            if let Some(on_release) = on_release {
                run(app, on_release);
            }
        }
    })
}

fn cancel_accelerator(app: &AppHandle) -> Option<String> {
    app.state::<VoiceShortcuts>().hotkey(Binding::Cancel).map(|hotkey| hotkey.to_accelerator())
}

pub(super) fn grab_cancel(app: &AppHandle) {
    let Some(cancel) = cancel_accelerator(app) else {
        return;
    };
    if let Err(e) = listen(app, &cancel, ShortcutEvent::Cancel, None) {
        eprintln!("[voice shortcuts] couldn't listen for {cancel}: {e}");
    }
}

pub(super) fn release_cancel(app: &AppHandle) {
    let Some(cancel) = cancel_accelerator(app) else {
        return;
    };
    let shortcuts = app.global_shortcut();
    if shortcuts.is_registered(cancel.as_str()) {
        let _ = shortcuts.unregister(cancel.as_str());
    }
}

pub(super) fn change(app: &AppHandle, binding: Binding, previous: Option<&Hotkey>, hotkey: &Hotkey) -> Result<()> {
    match binding {
        Binding::Record => {
            if let Err(e) = bind_record(app, previous, hotkey) {
                if let Some(previous) = previous {
                    let _ = bind_record(app, None, previous);
                }
                return Err(e);
            }
        }
        Binding::Cancel => {
            let grabbed =
                cancel_accelerator(app).is_some_and(|cancel| app.global_shortcut().is_registered(cancel.as_str()));
            if grabbed {
                release_cancel(app);
            }
            app.state::<VoiceShortcuts>().remember(Binding::Cancel, Some(hotkey.clone()), None);
            if grabbed {
                grab_cancel(app);
            }
        }
    }
    Ok(())
}
