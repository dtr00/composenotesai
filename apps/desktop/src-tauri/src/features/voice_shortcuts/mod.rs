mod binding;
#[cfg(target_os = "linux")]
mod desktop;
#[cfg(target_os = "linux")]
mod gnome;
#[cfg(target_os = "linux")]
mod held_key;
mod hotkey;
mod plugin;
#[cfg(target_os = "linux")]
mod portal;
mod shortcuts;

pub use binding::Binding;
pub use shortcuts::{
    change, grab_cancel, hotkey, info, register, release_cancel, set_up, ShortcutEvent, ShortcutInfo,
};
