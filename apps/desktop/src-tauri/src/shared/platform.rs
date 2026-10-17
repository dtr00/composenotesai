#[cfg(target_os = "linux")]
pub fn on_wayland() -> bool {
    std::env::var_os("WAYLAND_DISPLAY").is_some()
        && std::env::var("XDG_SESSION_TYPE").map_or(true, |kind| kind == "wayland")
}

#[cfg(not(target_os = "linux"))]
pub fn on_wayland() -> bool {
    false
}

#[cfg(target_os = "linux")]
pub fn lower_thread_priority() {
    const BACKGROUND_NICE: libc::c_int = 10;
    unsafe {
        libc::setpriority(libc::PRIO_PROCESS, libc::gettid() as libc::id_t, BACKGROUND_NICE);
    }
}

#[cfg(not(target_os = "linux"))]
pub fn lower_thread_priority() {}
