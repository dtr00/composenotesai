use super::chat::{list_models, ChatEvent, ChatRequest, Endpoint, RemoteModel};
use super::engine::{Engine, InUse, ServerOptions, Weights};
use super::library::LanguageModels;
use super::ollama::sees_images;
use crate::entities::ai::{AiSettings, ProviderKind, LOCAL_PROVIDER};
use crate::shared::cancel::CancelToken;
use crate::shared::error::{Error, Result};
use serde::Serialize;

#[derive(Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum SourceKind {
    Local,
    Ollama,
    OpenAi,
}

impl From<ProviderKind> for SourceKind {
    fn from(kind: ProviderKind) -> Self {
        match kind {
            ProviderKind::Ollama => SourceKind::Ollama,
            ProviderKind::OpenAi => SourceKind::OpenAi,
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderModels {
    provider: String,
    name: String,
    kind: SourceKind,
    models: Vec<RemoteModel>,
    error: Option<String>,
}

pub struct Connected<'a> {
    pub endpoint: Endpoint,
    _in_use: Option<InUse<'a>>,
}

fn server_options(ai: &AiSettings) -> ServerOptions {
    ServerOptions { context_size: ai.context_size, use_gpu: ai.use_gpu, threads: ai.threads }
}

fn local_models(library: &LanguageModels) -> Vec<RemoteModel> {
    library
        .installed()
        .into_iter()
        .map(|model| RemoteModel {
            id: model.id,
            name: model.name,
            size_bytes: Some(model.size_bytes),
            details: None,
            vision: model.vision.is_some_and(|vision| vision.installed),
        })
        .collect()
}

pub async fn list_sources(
    client: &reqwest::Client,
    library: &LanguageModels,
    ai: AiSettings,
) -> Result<Vec<ProviderModels>> {
    let lookups: Vec<_> = ai
        .providers
        .into_iter()
        .filter(|provider| provider.enabled)
        .map(|provider| {
            let client = client.clone();
            tauri::async_runtime::spawn(async move {
                let (models, error) = match list_models(&client, &Endpoint::from(&provider)).await {
                    Ok(models) => (models, None),
                    Err(error) => (Vec::new(), Some(error.to_string())),
                };
                ProviderModels { provider: provider.id, name: provider.name, kind: provider.kind.into(), models, error }
            })
        })
        .collect();
    let mut sources = vec![ProviderModels {
        provider: LOCAL_PROVIDER.into(),
        name: "This device".into(),
        kind: SourceKind::Local,
        models: local_models(library),
        error: None,
    }];
    for lookup in lookups {
        sources.push(lookup.await.map_err(|_| Error::Message("Listing models stopped unexpectedly.".into()))?);
    }
    Ok(sources)
}

pub async fn connect<'a>(
    engine: &'a Engine,
    library: &LanguageModels,
    client: &reqwest::Client,
    ai: &AiSettings,
    request: &ChatRequest,
    cancel: &CancelToken,
    emit: &(dyn Fn(ChatEvent) + Sync),
) -> Result<Option<Connected<'a>>> {
    request.check_images()?;
    if request.provider != LOCAL_PROVIDER {
        let provider = ai.provider(&request.provider).filter(|provider| provider.enabled).ok_or_else(|| {
            Error::Message("This model's provider was removed or turned off. Pick another model.".into())
        })?;
        let ollama_sees_images = || sees_images(client, &provider.base_url, &request.model);
        if request.has_images() && !(provider.kind == ProviderKind::Ollama && ollama_sees_images().await) {
            return Err(Error::Message(
                "Images only go to models on this device or to local Ollama models that can see images.".into(),
            ));
        }
        return Ok(Some(Connected { endpoint: Endpoint::from(provider), _in_use: None }));
    }
    let path = library.path(&request.model)?;
    let projector = library.projector(&request.model);
    let name = library.name(&request.model);
    if request.has_images() && projector.is_none() {
        return Err(Error::Message(format!(
            "{name} can't see images yet. Add its vision download in Settings > AI, or pick a model that can."
        )));
    }
    let in_use = engine.begin_use();
    let weights = Weights { model: &path, projector: projector.as_deref() };
    let loading = || emit(ChatEvent::Status { message: format!("Loading {name}…") });
    let Some(connection) = cancel.run(engine.ensure(weights, server_options(ai), loading)).await else {
        return Ok(None);
    };
    let connection = connection?;
    let endpoint = Endpoint::Llama { base_url: connection.base_url, api_key: connection.api_key };
    Ok(Some(Connected { endpoint, _in_use: Some(in_use) }))
}
