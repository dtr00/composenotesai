use crate::features::browser;
use crate::features::settings::SettingsStore;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager};

const CHECK_EVERY: Duration = Duration::from_secs(5 * 60);
const HOUR: Duration = Duration::from_secs(60 * 60);

fn is_due(app: &AppHandle, cleared: Instant) -> bool {
    match app.state::<SettingsStore>().load() {
        Ok(settings) => {
            let hours = settings.browser_cache_clear_hours;
            hours > 0 && cleared.elapsed() >= HOUR * hours
        }
        Err(error) => {
            eprintln!("[browser] couldn't read the cache clean-up setting: {error}");
            false
        }
    }
}

pub fn clear_on_schedule(app: &AppHandle) {
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        loop {
            if let Err(error) = browser::clear_cache(&app).await {
                eprintln!("[browser] couldn't clear the cache: {error}");
            }
            let cleared = Instant::now();
            while !is_due(&app, cleared) {
                tokio::time::sleep(CHECK_EVERY).await;
            }
        }
    });
}
