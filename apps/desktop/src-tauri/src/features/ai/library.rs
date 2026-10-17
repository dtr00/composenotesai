use super::catalog::{find_language_model, LANGUAGE_MODELS};
use crate::entities::catalog::{busy_message, unknown_model, CatalogFiles};
use crate::shared::download::{is_part, Expected, Progress};
use crate::shared::error::{Error, Result};
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

const URL_DOWNLOAD: &str = "url";
const GGUF_EXTENSION: &str = "gguf";
const MAX_FILE_NAME_LEN: usize = 200;
const VISION_FOLDER: &str = "vision";

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct VisionAddOn {
    pub size_bytes: u64,
    pub installed: bool,
}

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LanguageModel {
    pub id: String,
    pub name: String,
    pub description: Option<&'static str>,
    pub size_bytes: u64,
    pub installed: bool,
    pub custom: bool,
    pub vision: Option<VisionAddOn>,
}

pub struct LanguageModels {
    files: CatalogFiles,
    vision: CatalogFiles,
}

fn is_model_file(name: &str) -> bool {
    let valid = !name.is_empty()
        && name.len() <= MAX_FILE_NAME_LEN
        && !name.starts_with('.')
        && name.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_'));
    valid && Path::new(name).extension().is_some_and(|extension| extension.eq_ignore_ascii_case(GGUF_EXTENSION))
}

fn model_url(url: &str) -> Result<(String, String)> {
    let url = url.trim();
    let invalid = || Error::Message("Enter a link to a .gguf file, such as one from Hugging Face.".into());
    if !url.starts_with("https://") && !url.starts_with("http://") {
        return Err(invalid());
    }
    let without_query = url.split(['?', '#']).next().unwrap_or(url);
    let file = without_query.rsplit('/').next().unwrap_or_default();
    if !is_model_file(file) {
        return Err(invalid());
    }
    let direct = if without_query.contains("huggingface.co/") {
        without_query.replacen("/blob/", "/resolve/", 1)
    } else {
        url.to_owned()
    };
    Ok((direct, file.to_owned()))
}

fn display_name(file: &str) -> String {
    file.strip_suffix(".gguf").or_else(|| file.strip_suffix(".GGUF")).unwrap_or(file).to_owned()
}

impl LanguageModels {
    pub fn new(dir: PathBuf, client: reqwest::Client) -> Self {
        let vision = CatalogFiles::new(dir.join(VISION_FOLDER), client.clone());
        Self { vision, files: CatalogFiles::new(dir, client) }
    }

    fn installed_files(&self) -> Vec<(String, u64)> {
        let Ok(entries) = fs::read_dir(self.files.dir()) else {
            return Vec::new();
        };
        let mut files: Vec<(String, u64)> = entries
            .flatten()
            .filter(|entry| !is_part(&entry.path()))
            .filter_map(|entry| {
                let name = entry.file_name().into_string().ok()?;
                let size = entry.metadata().ok().filter(|meta| meta.is_file())?.len();
                is_model_file(&name).then_some((name, size))
            })
            .collect();
        files.sort();
        files
    }

    fn is_complete(&self, file: &str, size: u64) -> bool {
        find_language_model(file).is_none_or(|spec| spec.download.size == size)
    }

    pub fn list(&self) -> Vec<LanguageModel> {
        let installed = self.installed_files();
        let size_of = |file: &str| installed.iter().find(|(name, _)| name == file).map(|(_, size)| *size);
        let catalog = LANGUAGE_MODELS.iter().map(|model| LanguageModel {
            id: model.download.file.to_owned(),
            name: model.download.name.to_owned(),
            description: Some(model.description),
            size_bytes: model.download.size,
            installed: size_of(model.download.file) == Some(model.download.size),
            custom: false,
            vision: Some(VisionAddOn {
                size_bytes: model.vision.size,
                installed: self.vision.is_installed(&model.vision),
            }),
        });
        let custom = installed.iter().filter(|(file, _)| find_language_model(file).is_none());
        let custom = custom.map(|(file, size)| LanguageModel {
            id: file.clone(),
            name: display_name(file),
            description: None,
            size_bytes: *size,
            installed: true,
            custom: true,
            vision: None,
        });
        catalog.chain(custom).collect()
    }

    pub fn installed(&self) -> Vec<LanguageModel> {
        self.list().into_iter().filter(|model| model.installed).collect()
    }

    pub fn name(&self, id: &str) -> String {
        find_language_model(id).map_or_else(|| display_name(id), |spec| spec.download.name.to_owned())
    }

    pub fn path(&self, id: &str) -> Result<PathBuf> {
        let installed = self.installed_files();
        installed
            .iter()
            .find(|(file, size)| file == id && self.is_complete(file, *size))
            .map(|(file, _)| self.files.path(file))
            .ok_or_else(|| Error::Message(format!("{} isn't downloaded. Download it in Settings > AI.", self.name(id))))
    }

    pub fn projector(&self, id: &str) -> Option<PathBuf> {
        let spec = &find_language_model(id)?.vision;
        self.vision.is_installed(spec).then(|| self.vision.path(spec.file))
    }

    pub fn remove(&self, id: &str) -> Result<()> {
        if !is_model_file(id) {
            return Err(unknown_model(id));
        }
        self.remove_vision(id)?;
        self.files.remove(id)
    }

    pub fn remove_vision(&self, id: &str) -> Result<()> {
        find_language_model(id).map_or(Ok(()), |spec| self.vision.remove(spec.vision.file))
    }

    pub async fn download_vision(&self, id: &str, on_progress: impl Fn(Progress)) -> Result<bool> {
        let spec = find_language_model(id).ok_or_else(|| unknown_model(id))?;
        self.path(id)?;
        self.vision.download(&spec.vision, on_progress).await
    }

    pub fn cancel_vision(&self, id: &str) {
        if let Some(spec) = find_language_model(id) {
            self.vision.downloads().cancel(spec.vision.file);
        }
    }

    pub fn cancel(&self, id: &str) {
        self.files.downloads().cancel(id);
    }

    pub async fn download(&self, id: &str, on_progress: impl Fn(Progress)) -> Result<bool> {
        let spec = find_language_model(id).ok_or_else(|| unknown_model(id))?;
        self.files.download(&spec.download, on_progress).await
    }

    pub async fn download_url(&self, url: &str, on_progress: impl Fn(Progress)) -> Result<Option<String>> {
        let (url, file) = model_url(url)?;
        if self.installed_files().iter().any(|(name, _)| *name == file) {
            return Err(Error::Message(format!("{} is already downloaded.", display_name(&file))));
        }
        let downloads = self.files.downloads();
        let running = downloads.begin(URL_DOWNLOAD, "A model is already downloading from a link.")?;
        let _file = downloads.begin(&file, &busy_message(&display_name(&file)))?;
        let finished = self.files.fetch(&url, &file, Expected::default(), running.token(), on_progress).await?;
        Ok(finished.then_some(file))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::shared::testing::{install_tls, temp_dir};

    fn temp_library(name: &str) -> LanguageModels {
        install_tls();
        LanguageModels::new(temp_dir(&format!("language-models-{name}")), reqwest::Client::new())
    }

    fn install(library: &LanguageModels, file: &str, size: u64) {
        fs::File::create(library.files.path(file)).unwrap().set_len(size).unwrap();
    }

    #[test]
    fn lists_the_catalog_and_custom_files_but_not_partial_downloads() {
        let library = temp_library("list");
        let spec = &LANGUAGE_MODELS[0].download;
        install(&library, spec.file, spec.size);
        install(&library, "my-model.Q4.gguf", 10);
        install(&library, "other.gguf.part", 10);
        install(&library, "notes.txt", 10);
        let models = library.list();
        assert_eq!(models.len(), LANGUAGE_MODELS.len() + 1);
        assert!(models.iter().any(|model| model.id == spec.file && model.installed && !model.custom));
        let custom = models.iter().find(|model| model.custom).unwrap();
        assert_eq!(
            (custom.id.as_str(), custom.name.as_str(), custom.size_bytes),
            ("my-model.Q4.gguf", "my-model.Q4", 10)
        );
        assert_eq!(library.installed().len(), 2);
    }

    #[test]
    fn a_truncated_catalog_model_is_not_usable() {
        let library = temp_library("truncated");
        let spec = &LANGUAGE_MODELS[0].download;
        install(&library, spec.file, spec.size - 1);
        assert!(library.path(spec.file).is_err());
        assert!(library.list().iter().all(|model| !model.installed));
        install(&library, "custom.gguf", 3);
        assert_eq!(library.path("custom.gguf").unwrap(), library.files.path("custom.gguf"));
    }

    #[test]
    fn vision_add_ons_need_a_complete_projector_and_go_with_their_model() {
        let library = temp_library("vision");
        let model = &LANGUAGE_MODELS[0];
        install(&library, model.download.file, model.download.size);
        fs::create_dir_all(library.vision.dir()).unwrap();
        let projector = library.vision.path(model.vision.file);
        fs::File::create(&projector).unwrap().set_len(model.vision.size - 1).unwrap();
        assert_eq!(library.projector(model.download.file), None);
        fs::File::create(&projector).unwrap().set_len(model.vision.size).unwrap();
        assert_eq!(library.projector(model.download.file), Some(projector.clone()));
        let listed = library.list().into_iter().find(|listed| listed.id == model.download.file).unwrap();
        assert_eq!(listed.vision, Some(VisionAddOn { size_bytes: model.vision.size, installed: true }));
        assert_eq!(library.installed().len(), 1);
        library.remove(model.download.file).unwrap();
        assert!(!projector.exists());
    }

    #[test]
    fn vision_downloads_need_the_model_first() {
        let library = temp_library("vision-first");
        let id = LANGUAGE_MODELS[0].download.file;
        let result = tauri::async_runtime::block_on(library.download_vision(id, |_| {}));
        assert!(result.unwrap_err().to_string().contains("isn't downloaded"));
        assert!(tauri::async_runtime::block_on(library.download_vision("custom.gguf", |_| {})).is_err());
    }

    #[test]
    fn removing_refuses_paths_outside_the_library() {
        let library = temp_library("remove");
        install(&library, "custom.gguf", 3);
        library.remove("custom.gguf").unwrap();
        library.remove("custom.gguf").unwrap();
        assert!(library.remove("../notes.db").is_err());
        assert!(library.remove("model.bin").is_err());
    }

    #[test]
    fn link_downloads_are_cancelled_by_the_url_id() {
        let library = temp_library("url");
        let running = library.files.downloads().begin(URL_DOWNLOAD, "").unwrap();
        let second = tauri::async_runtime::block_on(library.download_url("https://example.com/a.gguf", |_| {}));
        assert_eq!(second.err().map(|e| e.to_string()).as_deref(), Some("A model is already downloading from a link."));
        library.cancel("url");
        assert!(running.token().is_cancelled());
    }

    #[test]
    fn reads_model_links() {
        assert_eq!(
            model_url("https://huggingface.co/org/repo/blob/main/Model-Q4_K_M.gguf?download=true").unwrap(),
            ("https://huggingface.co/org/repo/resolve/main/Model-Q4_K_M.gguf".into(), "Model-Q4_K_M.gguf".into())
        );
        assert_eq!(model_url("http://server.lan/files/model.gguf").unwrap().1, "model.gguf");
        assert!(model_url("https://example.com/model.bin").is_err());
        assert!(model_url("file:///home/me/model.gguf").is_err());
        assert!(model_url("https://example.com/..gguf").is_err());
    }
}
