use super::catalog::{find_speech_model, SpeechModelSpec, SPEECH_MODELS};
use crate::entities::catalog::{unknown_model, CatalogFiles};
use crate::shared::download::Progress;
use crate::shared::error::Result;
use serde::Serialize;
use std::path::{Path, PathBuf};

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SpeechModel {
    pub id: &'static str,
    pub name: &'static str,
    pub description: &'static str,
    pub size_bytes: u64,
    pub installed: bool,
}

pub struct SpeechModels {
    files: CatalogFiles,
}

impl SpeechModels {
    pub fn new(dir: PathBuf, client: reqwest::Client) -> Self {
        Self { files: CatalogFiles::new(dir, client) }
    }

    pub fn list(&self) -> Vec<SpeechModel> {
        SPEECH_MODELS
            .iter()
            .map(|spec| SpeechModel {
                id: spec.id,
                name: spec.download.name,
                description: spec.description,
                size_bytes: spec.download.size,
                installed: self.is_installed(spec),
            })
            .collect()
    }

    pub fn dir(&self) -> &Path {
        self.files.dir()
    }

    fn path(&self, id: &str) -> Option<PathBuf> {
        find_speech_model(id).filter(|spec| self.is_installed(spec)).map(|spec| self.files.path(spec.download.file))
    }

    pub fn usable_path(&self, preferred: Option<&str>) -> Option<PathBuf> {
        preferred.and_then(|id| self.path(id)).or_else(|| {
            SPEECH_MODELS.iter().find(|spec| self.is_installed(spec)).map(|spec| self.files.path(spec.download.file))
        })
    }

    pub fn remove(&self, id: &str) -> Result<()> {
        let spec = find_speech_model(id).ok_or_else(|| unknown_model(id))?;
        self.files.remove(spec.download.file)
    }

    pub fn cancel(&self, id: &str) {
        if let Some(spec) = find_speech_model(id) {
            self.files.downloads().cancel(spec.download.file);
        }
    }

    pub async fn download(&self, id: &str, on_progress: impl Fn(Progress)) -> Result<bool> {
        let spec = find_speech_model(id).ok_or_else(|| unknown_model(id))?;
        self.files.download(&spec.download, on_progress).await
    }

    fn is_installed(&self, spec: &SpeechModelSpec) -> bool {
        self.files.is_installed(&spec.download)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::shared::testing::{install_tls, temp_dir};
    use std::fs;

    fn temp_store(name: &str) -> SpeechModels {
        install_tls();
        SpeechModels::new(temp_dir(&format!("speech-models-{name}")), reqwest::Client::new())
    }

    fn install(store: &SpeechModels, spec: &SpeechModelSpec, size: u64) {
        fs::create_dir_all(store.dir()).unwrap();
        fs::File::create(store.dir().join(spec.download.file)).unwrap().set_len(size).unwrap();
    }

    #[test]
    fn nothing_is_installed_at_first() {
        let store = temp_store("empty");
        assert!(store.list().iter().all(|model| !model.installed));
    }

    #[test]
    fn a_complete_file_counts_as_installed() {
        let store = temp_store("installed");
        let spec = find_speech_model("base").unwrap();
        install(&store, spec, spec.download.size);
        let installed: Vec<&str> = store.list().iter().filter(|model| model.installed).map(|model| model.id).collect();
        assert_eq!(installed, ["base"]);
    }

    #[test]
    fn usable_path_prefers_the_chosen_model_then_any_installed_one() {
        let store = temp_store("usable");
        assert_eq!(store.usable_path(Some("base")), None);
        let base = find_speech_model("base").unwrap();
        let small = find_speech_model("small").unwrap();
        install(&store, small, small.download.size);
        assert_eq!(store.usable_path(None), Some(store.dir().join(small.download.file)));
        assert_eq!(store.usable_path(Some("base")), Some(store.dir().join(small.download.file)));
        install(&store, base, base.download.size);
        assert_eq!(store.usable_path(Some("base")), Some(store.dir().join(base.download.file)));
    }

    #[test]
    fn a_truncated_file_does_not_count() {
        let store = temp_store("truncated");
        let spec = find_speech_model("base").unwrap();
        install(&store, spec, spec.download.size - 1);
        assert!(store.list().iter().all(|model| !model.installed));
    }

    #[test]
    fn removing_deletes_the_file_and_tolerates_missing_ones() {
        let store = temp_store("remove");
        let spec = find_speech_model("base").unwrap();
        install(&store, spec, spec.download.size);
        store.remove("base").unwrap();
        assert!(store.list().iter().all(|model| !model.installed));
        store.remove("base").unwrap();
        assert!(store.remove("huge").is_err());
    }

    #[test]
    #[ignore = "downloads the 60 MB base model from Hugging Face"]
    fn downloads_and_verifies_the_base_model() {
        let store = temp_store("download");
        let seen = std::sync::Mutex::new(Vec::new());
        let finished =
            tauri::async_runtime::block_on(store.download("base", |p| seen.lock().unwrap().push(p.downloaded)));
        assert!(finished.unwrap());
        assert!(store.list().iter().any(|model| model.id == "base" && model.installed));
        assert!(seen.lock().unwrap().windows(2).all(|pair| pair[0] <= pair[1]));
        assert!(!store.dir().join("ggml-base-q5_1.bin.part").exists());
        fs::remove_dir_all(store.dir()).unwrap();
    }
}
