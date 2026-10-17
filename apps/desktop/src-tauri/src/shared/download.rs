use crate::shared::cancel::CancelToken;
use crate::shared::error::{Error, Result};
use crate::shared::text::hex;
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

const PROGRESS_INTERVAL: Duration = Duration::from_millis(100);
const PART_EXTENSION: &str = "part";

#[derive(Clone, Copy, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Progress {
    pub downloaded: u64,
    pub total: u64,
}

#[derive(Clone, Copy, Default)]
pub struct Expected<'a> {
    pub size: Option<u64>,
    pub sha256: Option<&'a str>,
}

fn part_path(target: &Path) -> PathBuf {
    let mut name = target.as_os_str().to_owned();
    name.push(".");
    name.push(PART_EXTENSION);
    name.into()
}

pub fn is_part(path: &Path) -> bool {
    path.extension().is_some_and(|extension| extension == PART_EXTENSION)
}

pub async fn download(
    client: &reqwest::Client,
    url: &str,
    target: &Path,
    expected: Expected<'_>,
    cancel: &CancelToken,
    on_progress: impl Fn(Progress),
) -> Result<bool> {
    if let Some(dir) = target.parent() {
        fs::create_dir_all(dir)?;
    }
    let part = part_path(target);
    let outcome = write_part(client, url, &part, expected, cancel, &on_progress).await;
    match outcome {
        Ok(true) => fs::rename(&part, target)?,
        _ => {
            let _ = fs::remove_file(&part);
        }
    }
    outcome
}

async fn write_part(
    client: &reqwest::Client,
    url: &str,
    part: &Path,
    expected: Expected<'_>,
    cancel: &CancelToken,
    on_progress: &impl Fn(Progress),
) -> Result<bool> {
    let Some(response) = cancel.run(client.get(url).send()).await else {
        return Ok(false);
    };
    let mut response = response?.error_for_status()?;
    let total = expected.size.or(response.content_length()).unwrap_or(0);
    let mut file = File::create(part)?;
    let mut hash = Sha256::new();
    let mut downloaded = 0;
    let mut last_sent = Instant::now();
    loop {
        let Some(chunk) = cancel.run(response.chunk()).await else {
            return Ok(false);
        };
        let Some(chunk) = chunk? else {
            break;
        };
        file.write_all(&chunk)?;
        if expected.sha256.is_some() {
            hash.update(&chunk);
        }
        downloaded += chunk.len() as u64;
        if last_sent.elapsed() >= PROGRESS_INTERVAL {
            last_sent = Instant::now();
            on_progress(Progress { downloaded, total: total.max(downloaded) });
        }
    }
    file.flush()?;
    on_progress(Progress { downloaded, total: total.max(downloaded) });
    let wrong_size = (expected.size.is_some() || total > 0) && downloaded != total;
    let wrong_hash = expected.sha256.is_some_and(|sha256| hex(&hash.finalize()) != sha256);
    if downloaded == 0 || wrong_size || wrong_hash {
        return Err(Error::Message("The download was incomplete or damaged. Try again.".into()));
    }
    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn part_files_sit_next_to_their_target() {
        let part = part_path(Path::new("/models/model.v1.gguf"));
        assert_eq!(part, Path::new("/models/model.v1.gguf.part"));
        assert!(is_part(&part));
        assert!(!is_part(Path::new("/models/model.gguf")));
    }
}
