use crate::features::browser;
use crate::features::settings::SettingsStore;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager};

const CHECK_EVERY: Duration = Duration::from_secs(5 * 60);
const HOUR: Duration = Duration::from_secs(60 * 60);

pub fn clear_on_schedule(app: &AppHandle) {
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        let mut cleared = Instant::now();
        loop {
            tokio::time::sleep(CHECK_EVERY).await;
            let hours = match app.state::<SettingsStore>().load() {
                Ok(settings) => settings.browser_cache_clear_hours,
                Err(error) => {
                    eprintln!("[browser] couldn't read the cache clean-up setting: {error}");
                    continue;
                }
            };
            if hours == 0 || cleared.elapsed() < HOUR * hours {
                continue;
            }
            if let Err(error) = browser::clear_cache(&app) {
                eprintln!("[browser] couldn't clear the cache: {error}");
            }
            cleared = Instant::now();
        }
    });
}
