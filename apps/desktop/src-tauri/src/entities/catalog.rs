use crate::shared::cancel::{CancelToken, Registry};
use crate::shared::download::{download, Expected, Progress};
use crate::shared::error::{Error, Result};
use std::fs;
use std::path::{Path, PathBuf};

pub struct CatalogSpec {
    pub file: &'static str,
    pub name: &'static str,
    pub url: &'static str,
    pub size: u64,
    pub sha256: &'static str,
}

pub struct CatalogFiles {
    dir: PathBuf,
    client: reqwest::Client,
    downloads: Registry,
}

pub fn busy_message(name: &str) -> String {
    format!("{name} is already downloading.")
}

pub fn unknown_model(id: &str) -> Error {
    Error::Message(format!("There's no model called “{id}”."))
}

impl CatalogFiles {
    pub fn new(dir: PathBuf, client: reqwest::Client) -> Self {
        Self { dir, client, downloads: Registry::default() }
    }

    pub fn dir(&self) -> &Path {
        &self.dir
    }

    pub fn path(&self, file: &str) -> PathBuf {
        self.dir.join(file)
    }

    pub fn downloads(&self) -> &Registry {
        &self.downloads
    }

    pub fn is_installed(&self, spec: &CatalogSpec) -> bool {
        fs::metadata(self.path(spec.file)).is_ok_and(|meta| meta.is_file() && meta.len() == spec.size)
    }

    pub fn remove(&self, file: &str) -> Result<()> {
        match fs::remove_file(self.path(file)) {
            Err(e) if e.kind() != std::io::ErrorKind::NotFound => Err(e.into()),
            _ => Ok(()),
        }
    }

    pub async fn download(&self, spec: &CatalogSpec, on_progress: impl Fn(Progress)) -> Result<bool> {
        let running = self.downloads.begin(spec.file, &busy_message(spec.name))?;
        let expected = Expected { size: Some(spec.size), sha256: Some(spec.sha256) };
        self.fetch(spec.url, spec.file, expected, running.token(), on_progress).await
    }

    pub async fn fetch(
        &self,
        url: &str,
        file: &str,
        expected: Expected<'_>,
        cancel: &CancelToken,
        on_progress: impl Fn(Progress),
    ) -> Result<bool> {
        download(&self.client, url, &self.path(file), expected, cancel, on_progress).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::shared::testing::{install_tls, temp_dir};

    const SPEC: CatalogSpec = CatalogSpec { file: "model.bin", name: "Model", url: "", size: 4, sha256: "" };

    fn temp_files(name: &str) -> CatalogFiles {
        install_tls();
        CatalogFiles::new(temp_dir(&format!("catalog-{name}")), reqwest::Client::new())
    }

    #[test]
    fn only_complete_files_count_as_installed() {
        let files = temp_files("installed");
        assert!(!files.is_installed(&SPEC));
        fs::write(files.path(SPEC.file), b"abc").unwrap();
        assert!(!files.is_installed(&SPEC));
        fs::write(files.path(SPEC.file), b"abcd").unwrap();
        assert!(files.is_installed(&SPEC));
        files.remove(SPEC.file).unwrap();
        files.remove(SPEC.file).unwrap();
        assert!(!files.is_installed(&SPEC));
        fs::remove_dir_all(files.dir()).unwrap();
    }

    #[test]
    fn a_running_download_refuses_a_second_start() {
        let files = temp_files("busy");
        let _running = files.downloads().begin(SPEC.file, &busy_message(SPEC.name)).unwrap();
        let second = tauri::async_runtime::block_on(files.download(&SPEC, |_| {}));
        assert_eq!(second.err().map(|e| e.to_string()).as_deref(), Some("Model is already downloading."));
        fs::remove_dir_all(files.dir()).unwrap();
    }

    #[test]
    fn a_cancelled_download_stops_without_leaving_a_part_file() {
        let files = temp_files("cancel");
        let token = CancelToken::default();
        token.cancel();
        let url = "http://127.0.0.1:9/model.bin";
        let finished =
            tauri::async_runtime::block_on(files.fetch(url, SPEC.file, Expected::default(), &token, |_| {})).unwrap();
        assert!(!finished);
        assert!(!fs::read_dir(files.dir()).unwrap().any(|entry| entry.is_ok()));
        fs::remove_dir_all(files.dir()).unwrap();
    }
}
