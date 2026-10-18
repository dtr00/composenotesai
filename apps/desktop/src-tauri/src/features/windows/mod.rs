#[cfg(target_os = "linux")]
mod edge_resize;
mod overlay;
mod tray;
mod window;

pub use overlay::{
    build_voice_overlay, close_voice_overlay, listen_to_parent, read_from_parent, relay_to_overlay,
    show_voice_overlay, OverlayProcess, OVERLAY_PROCESS_ARG,
};
pub use tray::install_tray;
pub use window::{
    app_in_front, create_main_window, keep_main_window_alive, main_window_in_front, open_window, show_main_window,
};
