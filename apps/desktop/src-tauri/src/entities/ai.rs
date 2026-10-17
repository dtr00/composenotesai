use crate::shared::bounded::{Bounded, BoundedU32};
use crate::shared::web::is_http;
use serde::{Deserialize, Serialize};
use tauri::Url;

pub const LOCAL_PROVIDER: &str = "local";
const MAX_PROVIDERS: usize = 16;
const MAX_TEXT_LEN: usize = 512;
const MAX_INSTRUCTIONS_LEN: usize = 32_000;

pub const TEMPERATURE: Bounded = Bounded { min: 0.0, max: 2.0, default: 0.7 };
pub const TOP_P: Bounded = Bounded { min: 0.05, max: 1.0, default: 0.95 };
pub const MAX_TOKENS: BoundedU32 = BoundedU32 { min: 0, max: 32_768, default: 0 };
pub const CONTEXT_SIZE: BoundedU32 = BoundedU32 { min: 2_048, max: 262_144, default: 16_384 };
pub const THREADS: BoundedU32 = BoundedU32 { min: 0, max: 256, default: 0 };
pub const KEEP_LOADED_MINUTES: BoundedU32 = BoundedU32 { min: 0, max: 1_440, default: 15 };

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ProviderKind {
    Ollama,
    OpenAi,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderConfig {
    pub id: String,
    pub kind: ProviderKind,
    pub name: String,
    pub base_url: String,
    #[serde(default)]
    pub api_key: Option<String>,
    #[serde(default = "enabled")]
    pub enabled: bool,
}

const fn enabled() -> bool {
    true
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelRef {
    pub provider: String,
    pub model: String,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AiSettings {
    pub providers: Vec<ProviderConfig>,
    pub model: Option<ModelRef>,
    pub temperature: f64,
    pub top_p: f64,
    pub max_tokens: u32,
    pub context_size: u32,
    pub thinking: bool,
    pub allow_edits: bool,
    pub use_gpu: bool,
    pub threads: u32,
    pub keep_loaded_minutes: u32,
    pub instructions: Option<String>,
    pub web_search: bool,
}

impl Default for AiSettings {
    fn default() -> Self {
        Self {
            providers: Vec::new(),
            model: None,
            temperature: TEMPERATURE.default,
            top_p: TOP_P.default,
            max_tokens: MAX_TOKENS.default,
            context_size: CONTEXT_SIZE.default,
            thinking: false,
            allow_edits: true,
            use_gpu: true,
            threads: THREADS.default,
            keep_loaded_minutes: KEEP_LOADED_MINUTES.default,
            instructions: None,
            web_search: true,
        }
    }
}

fn short(text: &str) -> String {
    text.trim().chars().take(MAX_TEXT_LEN).collect()
}

fn is_web_url(url: &str) -> bool {
    Url::parse(url).is_ok_and(|url| is_http(&url) && url.host_str().is_some_and(|host| !host.is_empty()))
}

impl ProviderConfig {
    fn sanitized(self) -> Option<Self> {
        let id = short(&self.id);
        let base_url = short(&self.base_url).trim_end_matches('/').to_owned();
        let valid_id =
            !id.is_empty() && id != LOCAL_PROVIDER && id.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-');
        if !valid_id || !is_web_url(&base_url) {
            return None;
        }
        let name = short(&self.name);
        Some(Self {
            id,
            kind: self.kind,
            name: if name.is_empty() { base_url.clone() } else { name },
            base_url,
            api_key: self.api_key.map(|key| short(&key)).filter(|key| !key.is_empty()),
            enabled: self.enabled,
        })
    }
}

impl AiSettings {
    pub fn sanitized(self) -> Self {
        let mut providers: Vec<ProviderConfig> = Vec::new();
        for provider in self.providers.into_iter().filter_map(ProviderConfig::sanitized) {
            if providers.len() < MAX_PROVIDERS && providers.iter().all(|kept| kept.id != provider.id) {
                providers.push(provider);
            }
        }
        let model = self.model.filter(|model| {
            !model.model.is_empty()
                && (model.provider == LOCAL_PROVIDER || providers.iter().any(|provider| provider.id == model.provider))
        });
        Self {
            providers,
            model,
            temperature: TEMPERATURE.clamp(self.temperature),
            top_p: TOP_P.clamp(self.top_p),
            max_tokens: MAX_TOKENS.clamp(self.max_tokens),
            context_size: CONTEXT_SIZE.clamp(self.context_size),
            thinking: self.thinking,
            allow_edits: self.allow_edits,
            use_gpu: self.use_gpu,
            threads: THREADS.clamp(self.threads),
            keep_loaded_minutes: KEEP_LOADED_MINUTES.clamp(self.keep_loaded_minutes),
            instructions: self
                .instructions
                .map(|text| text.chars().take(MAX_INSTRUCTIONS_LEN).collect::<String>())
                .filter(|text| !text.trim().is_empty()),
            web_search: self.web_search,
        }
    }

    pub fn provider(&self, id: &str) -> Option<&ProviderConfig> {
        self.providers.iter().find(|provider| provider.id == id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn provider(id: &str, base_url: &str) -> ProviderConfig {
        ProviderConfig {
            id: id.into(),
            kind: ProviderKind::Ollama,
            name: String::new(),
            base_url: base_url.into(),
            api_key: Some("  ".into()),
            enabled: true,
        }
    }

    #[test]
    fn keeps_valid_providers_once_and_names_them_by_url() {
        let settings = AiSettings {
            providers: vec![
                provider("home", "http://192.168.1.4:11434/"),
                provider("home", "http://other:11434"),
                provider("local", "http://localhost:1"),
                provider("bad id", "http://localhost:2"),
                provider("ftp", "ftp://example.com"),
            ],
            ..AiSettings::default()
        }
        .sanitized();
        assert_eq!(settings.providers.len(), 1);
        let kept = &settings.providers[0];
        assert_eq!(kept.base_url, "http://192.168.1.4:11434");
        assert_eq!(kept.name, "http://192.168.1.4:11434");
        assert_eq!(kept.api_key, None);
    }

    #[test]
    fn drops_a_chosen_model_whose_provider_is_gone() {
        let chosen = |provider: &str| AiSettings {
            model: Some(ModelRef { provider: provider.into(), model: "m".into() }),
            ..AiSettings::default()
        };
        assert!(chosen("missing").sanitized().model.is_none());
        assert!(chosen(LOCAL_PROVIDER).sanitized().model.is_some());
    }

    #[test]
    fn clamps_numbers_into_range() {
        let settings = AiSettings {
            temperature: 9.0,
            top_p: f64::NAN,
            context_size: 10,
            keep_loaded_minutes: 99_999,
            instructions: Some("   ".into()),
            ..AiSettings::default()
        }
        .sanitized();
        assert_eq!(settings.temperature, 2.0);
        assert_eq!(settings.top_p, TOP_P.default);
        assert_eq!(settings.context_size, CONTEXT_SIZE.min);
        assert_eq!(settings.keep_loaded_minutes, KEEP_LOADED_MINUTES.max);
        assert_eq!(settings.instructions, None);
    }

    #[test]
    fn missing_fields_fall_back_to_defaults() {
        let settings: AiSettings = serde_json::from_str(r#"{"temperature":0.2}"#).unwrap();
        assert_eq!(settings.temperature, 0.2);
        assert_eq!(settings.context_size, CONTEXT_SIZE.default);
        assert!(settings.allow_edits);
    }

    #[test]
    fn recognizes_web_urls() {
        assert!(is_web_url("http://localhost:11434"));
        assert!(is_web_url("https://ai.example.com/v1"));
        assert!(!is_web_url("http://"));
        assert!(!is_web_url("file:///etc"));
        assert!(!is_web_url("http://a b"));
    }
}
