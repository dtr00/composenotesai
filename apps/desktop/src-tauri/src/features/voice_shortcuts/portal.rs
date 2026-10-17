use super::binding::Binding;
use super::held_key::HeldKey;
use super::hotkey::Hotkey;
use super::shortcuts::{announce_changed, fire, Backend, ShortcutEvent, VoiceShortcuts};
use super::{desktop, gnome};
use crate::shared::error::{Error, Result};
use ashpd::desktop::global_shortcuts::{GlobalShortcuts, NewShortcut, Shortcut};
use ashpd::desktop::Session;
use ashpd::{register_host_app_with_connection, AppID};
use futures_util::StreamExt;
use std::process::{Command, Stdio};
use std::sync::Arc;
use tauri::async_runtime::{JoinHandle, Mutex};
use tauri::{AppHandle, Manager};

struct ActivePortal {
    portal: GlobalShortcuts,
    session: Session<GlobalShortcuts>,
}

struct Connection {
    active: Arc<ActivePortal>,
    listener: JoinHandle<()>,
}

#[derive(Default)]
struct PortalState(Mutex<Option<Connection>>);

pub(super) fn start(app: AppHandle, bind: bool) {
    app.manage(PortalState::default());
    if bind {
        tauri::async_runtime::spawn(async move {
            if let Err(e) = connect(&app).await {
                eprintln!("[voice shortcuts] portal shortcut failed: {e}");
                app.state::<VoiceShortcuts>().reset();
                announce_changed(&app);
            }
        });
    }
}

pub(super) async fn set_up(app: AppHandle) -> Result<()> {
    let (active, created) = connect(&app).await?;
    if created {
        return Ok(());
    }
    if active.portal.version() >= 2 {
        return active
            .portal
            .configure_shortcuts(&active.session, None, Default::default())
            .await
            .map_err(portal_error);
    }
    open_desktop_settings()
}

fn portal_error(error: ashpd::Error) -> Error {
    Error::Message(format!(
        "Couldn't configure the recording shortcut. Confirm the request on your desktop and try again. ({error})"
    ))
}

fn desktop_settings_command(desktop: &str) -> Option<Command> {
    if desktop.split(':').any(|name| name.eq_ignore_ascii_case("KDE")) {
        let mut command = Command::new("systemsettings");
        command.arg("kcm_keys");
        Some(command)
    } else {
        None
    }
}

fn open_desktop_settings() -> Result<()> {
    let desktop = std::env::var("XDG_CURRENT_DESKTOP").unwrap_or_default();
    let mut command = desktop_settings_command(&desktop).ok_or_else(|| {
        Error::Message("Your desktop doesn't support opening the shortcut editor. Change the binding in your desktop's shortcut settings.".into())
    })?;
    let mut child = command
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| Error::Message(format!("Couldn't open desktop settings. ({e})")))?;
    std::thread::spawn(move || {
        let _ = child.wait();
    });
    Ok(())
}

async fn connect(app: &AppHandle) -> Result<(Arc<ActivePortal>, bool)> {
    let state = app.state::<PortalState>();
    let mut current = state.0.lock().await;
    if let Some(connection) = current.as_ref() {
        return Ok((Arc::clone(&connection.active), false));
    }
    let connection = bind(app).await.map_err(portal_error)?;
    let active = Arc::clone(&connection.active);
    *current = Some(connection);
    Ok((active, true))
}

pub(super) async fn change(app: &AppHandle, binding: Binding, hotkey: &Hotkey) -> Result<()> {
    if !gnome::available() {
        return Err(Error::Message("Change this shortcut in your desktop's keyboard settings.".into()));
    }
    let previous = gnome::set(&app.config().identifier, binding.id(), hotkey)?;
    if let Err(e) = rebind(app).await {
        previous.restore();
        let _ = rebind(app).await;
        return Err(e);
    }
    Ok(())
}

async fn rebind(app: &AppHandle) -> Result<()> {
    let state = app.state::<PortalState>();
    let mut current = state.0.lock().await;
    if let Some(previous) = current.take() {
        previous.listener.abort();
        let _ = previous.active.session.close().await;
    }
    *current = Some(bind(app).await.map_err(portal_error)?);
    Ok(())
}

async fn bind(app: &AppHandle) -> ashpd::Result<Connection> {
    desktop::ensure(app)?;
    let app_id = AppID::try_from(app.config().identifier.as_str())?;
    let connection = ashpd::zbus::Connection::session().await?;
    register_host_app_with_connection(connection.clone(), app_id).await?;
    let portal = GlobalShortcuts::with_connection(connection).await?;
    let session = portal.create_session(Default::default()).await?;
    let activated = portal.receive_activated().await?;
    let deactivated = portal.receive_deactivated().await?;
    let changed = portal.receive_shortcuts_changed().await?;
    let state = app.state::<VoiceShortcuts>();
    let shortcuts = Binding::ALL.map(|binding| {
        let preferred = state.hotkey(binding).unwrap_or_else(|| binding.default_hotkey(Backend::Portal));
        NewShortcut::new(binding.id(), binding.description()).preferred_trigger(preferred.to_portal_trigger().as_str())
    });
    let bound =
        match portal.bind_shortcuts(&session, &shortcuts, None, Default::default()).await.and_then(|r| r.response()) {
            Ok(bound) => bound,
            Err(e) => {
                let _ = session.close().await;
                return Err(e);
            }
        };
    remember_shortcuts(app, bound.shortcuts());
    let session_path =
        serde_json::to_value(&session).map_err(|_| ashpd::Error::ParseError("Invalid shortcut session path"))?;
    let active = Arc::new(ActivePortal { portal, session });
    let listening = Arc::clone(&active);
    let app = app.clone();
    let record_key = HeldKey::new(gnome::available().then(gnome::key_repeat).flatten());
    let listener = tauri::async_runtime::spawn(async move {
        enum Event {
            Activated(ashpd::desktop::global_shortcuts::Activated),
            Deactivated(ashpd::desktop::global_shortcuts::Deactivated),
            Changed(ashpd::desktop::global_shortcuts::ShortcutsChanged),
        }
        let closed = async {
            match listening.session.receive_closed().await {
                Ok(mut events) => {
                    events.next().await;
                }
                Err(e) => eprintln!("[voice shortcuts] couldn't watch the shortcut session: {e}"),
            }
        };
        let keys = futures_util::stream::select(activated.map(Event::Activated), deactivated.map(Event::Deactivated));
        let events = futures_util::stream::select(keys, changed.map(Event::Changed)).take_until(closed);
        futures_util::pin_mut!(events);
        while let Some(event) = events.next().await {
            match event {
                Event::Activated(event) if Some(event.session_handle().as_str()) == session_path.as_str() => {
                    match Binding::from_id(event.shortcut_id()) {
                        Some(Binding::Record) => {
                            record_key.activated(&app, ShortcutEvent::Record, ShortcutEvent::ReleaseRecord)
                        }
                        Some(Binding::Cancel) => fire(&app, ShortcutEvent::Cancel),
                        None => {}
                    }
                }
                Event::Deactivated(event)
                    if Some(event.session_handle().as_str()) == session_path.as_str()
                        && Binding::from_id(event.shortcut_id()) == Some(Binding::Record) =>
                {
                    record_key.deactivated(&app, ShortcutEvent::ReleaseRecord);
                }
                Event::Changed(event) if Some(event.session_handle().as_str()) == session_path.as_str() => {
                    remember_shortcuts(&app, event.shortcuts());
                }
                _ => {}
            }
        }
        let state = app.state::<PortalState>();
        let mut current = state.0.lock().await;
        if current.as_ref().is_some_and(|connection| Arc::ptr_eq(&connection.active, &listening)) {
            *current = None;
            app.state::<VoiceShortcuts>().reset();
            announce_changed(&app);
        }
    });
    Ok(Connection { active, listener })
}

fn remember_shortcuts(app: &AppHandle, shortcuts: &[Shortcut]) {
    let state = app.state::<VoiceShortcuts>();
    for binding in Binding::ALL {
        let bound = shortcuts.iter().find(|shortcut| shortcut.id() == binding.id());
        let description = bound.map(|shortcut| shortcut.trigger_description());
        state.remember(binding, description.and_then(Hotkey::from_portal_description), description.map(str::to_owned));
    }
    announce_changed(app);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn opens_the_current_desktops_shortcut_settings() {
        let kde = desktop_settings_command("KDE").unwrap();
        assert_eq!(kde.get_program(), "systemsettings");
        assert_eq!(kde.get_args().collect::<Vec<_>>(), ["kcm_keys"]);
        assert!(desktop_settings_command("sway").is_none());
        assert!(desktop_settings_command("").is_none());
    }
}
