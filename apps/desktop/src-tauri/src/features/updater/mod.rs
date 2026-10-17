use crate::shared::error::Result;
use serde::Serialize;
use std::time::{Duration, Instant};
use tauri::ipc::Channel;
use tauri::AppHandle;
use tauri_plugin_updater::UpdaterExt;

const CHECK_TIMEOUT: Duration = Duration::from_secs(10);
const PROGRESS_INTERVAL: Duration = Duration::from_millis(50);

#[derive(Clone, Serialize)]
#[serde(tag = "event", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum UpdateEvent {
    Progress { downloaded: u64, total: Option<u64> },
    Installing,
}

pub async fn check_update(app: &AppHandle) -> Result<Option<String>> {
    if cfg!(debug_assertions) {
        return Ok(None);
    }
    let updater = app.updater_builder().timeout(CHECK_TIMEOUT).build()?;
    Ok(updater.check().await?.map(|update| update.version))
}

pub async fn install_update(app: &AppHandle, on_event: &Channel<UpdateEvent>) -> Result<()> {
    if cfg!(debug_assertions) {
        return Ok(());
    }
    let updater = app.updater_builder().timeout(CHECK_TIMEOUT).build()?;
    let Some(update) = updater.check().await? else {
        return Ok(());
    };
    let mut downloaded = 0;
    let mut last_sent = Instant::now();
    let bytes = update
        .download(
            |chunk, total| {
                downloaded += chunk as u64;
                if last_sent.elapsed() >= PROGRESS_INTERVAL || Some(downloaded) == total {
                    last_sent = Instant::now();
                    send(on_event, UpdateEvent::Progress { downloaded, total });
                }
            },
            || send(on_event, UpdateEvent::Installing),
        )
        .await?;
    update.install(bytes)?;
    app.restart()
}

fn send(channel: &Channel<UpdateEvent>, event: UpdateEvent) {
    let _ = channel.send(event);
}
