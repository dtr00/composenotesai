use crate::shared::disk::{file_bytes, folder_bytes, DiskUsage};
use serde::Serialize;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

const AI_FOLDER: &str = "ai";
const MODELS_FOLDER: &str = "models";
const ENGINE_FOLDER: &str = "engine";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WebviewBytes {
    name: String,
    bytes: u64,
}

pub fn ai_dir(data_dir: &Path) -> PathBuf {
    data_dir.join(AI_FOLDER)
}

pub fn language_model_dir(data_dir: &Path) -> PathBuf {
    ai_dir(data_dir).join(MODELS_FOLDER)
}

pub fn engine_dir(data_dir: &Path) -> PathBuf {
    ai_dir(data_dir).join(ENGINE_FOLDER)
}

pub fn speech_model_dir(data_dir: &Path) -> PathBuf {
    data_dir.join(MODELS_FOLDER)
}

fn children(folder: &Path) -> Vec<PathBuf> {
    let Ok(entries) = std::fs::read_dir(folder) else { return Vec::new() };
    entries.flatten().map(|entry| entry.path()).collect()
}

fn outermost(mut folders: Vec<PathBuf>) -> Vec<PathBuf> {
    folders.sort();
    folders.dedup();
    let mut kept: Vec<PathBuf> = Vec::new();
    for folder in folders {
        if !kept.iter().any(|outer| folder.starts_with(outer)) {
            kept.push(folder);
        }
    }
    kept
}

fn app_folders(app: &AppHandle) -> Vec<PathBuf> {
    let path = app.path();
    #[cfg_attr(not(target_os = "macos"), allow(unused_mut))]
    let mut folders: Vec<PathBuf> = [
        path.app_data_dir(),
        path.app_local_data_dir(),
        path.app_cache_dir(),
        path.app_config_dir(),
        path.app_log_dir(),
    ]
    .into_iter()
    .flatten()
    .collect();
    #[cfg(target_os = "macos")]
    if let Ok(home) = path.home_dir() {
        folders.push(home.join("Library/WebKit").join(&app.config().identifier));
    }
    outermost(folders)
}

pub fn app_bytes() -> u64 {
    if let Some(image) = std::env::var_os("APPIMAGE") {
        return file_bytes(Path::new(&image));
    }
    let Ok(exe) = std::env::current_exe() else { return 0 };
    if let Some(bundle) = exe.ancestors().find(|dir| dir.extension().is_some_and(|extension| extension == "app")) {
        return folder_bytes(bundle);
    }
    match exe.parent() {
        Some(dir) if cfg!(all(windows, not(debug_assertions))) => folder_bytes(dir),
        _ => file_bytes(&exe),
    }
}

pub fn webview_usage(app: &AppHandle, exclude: &[PathBuf]) -> Vec<WebviewBytes> {
    let mut disk = DiskUsage::default();
    let mut usage: Vec<WebviewBytes> = Vec::new();
    for path in app_folders(app).iter().flat_map(|folder| children(folder)) {
        if exclude.contains(&path) {
            continue;
        }
        let name = path.file_name().map_or_else(String::new, |name| name.to_string_lossy().into_owned());
        let bytes = disk.measure(&path);
        match usage.iter_mut().find(|entry| entry.name == name) {
            Some(entry) => entry.bytes += bytes,
            None => usage.push(WebviewBytes { name, bytes }),
        }
    }
    usage.retain(|entry| entry.bytes > 0);
    usage.sort_by_key(|item| std::cmp::Reverse(item.bytes));
    usage
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keeps_only_outermost_folders() {
        let folders = vec![
            PathBuf::from("/data/app"),
            PathBuf::from("/data/app/cache"),
            PathBuf::from("/cache/app"),
            PathBuf::from("/data/app"),
            PathBuf::from("/data/application"),
        ];
        assert_eq!(
            outermost(folders),
            [PathBuf::from("/cache/app"), PathBuf::from("/data/app"), PathBuf::from("/data/application")]
        );
    }
}
