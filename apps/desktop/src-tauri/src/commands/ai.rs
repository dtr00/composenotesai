use crate::entities::ai::{AiSettings, ProviderConfig, ProviderKind, LOCAL_PROVIDER};
use crate::features::ai::{
    connect, delete_ollama_model, list_models, list_sources, pull_ollama_model, stream_chat, ChatEvent, ChatRequest,
    Endpoint, Engine, EngineInfo, Generation, LanguageModel, LanguageModels, ProviderModels, RemoteModel,
};
use crate::features::settings::SettingsStore;
use crate::shared::cancel::Registry;
use crate::shared::download::Progress;
use crate::shared::error::{Error, Result};
use crate::shared::ipc::forward;
use std::time::Duration;
use tauri::ipc::Channel;
use tauri::{AppHandle, Manager, State};

const BUSY: &str = "This is already running.";

fn ollama_url(settings: &SettingsStore, provider: &str) -> Result<String> {
    let ai = settings.load()?.ai;
    let config = ai.provider(provider).filter(|config| config.kind == ProviderKind::Ollama);
    config.map(|config| config.base_url.clone()).ok_or_else(|| Error::Message("This Ollama server was removed.".into()))
}

#[tauri::command]
pub async fn ai_models(
    settings: State<'_, SettingsStore>,
    library: State<'_, LanguageModels>,
    client: State<'_, reqwest::Client>,
) -> Result<Vec<ProviderModels>> {
    list_sources(&client, &library, settings.load()?.ai).await
}

#[tauri::command]
pub async fn ai_test_provider(
    client: State<'_, reqwest::Client>,
    provider: ProviderConfig,
) -> Result<Vec<RemoteModel>> {
    list_models(&client, &Endpoint::from(&provider)).await
}

#[tauri::command]
pub async fn ai_chat(app: AppHandle, run_id: String, request: ChatRequest, on_event: Channel<ChatEvent>) -> Result<()> {
    let ai = app.state::<SettingsStore>().load()?.ai;
    let chatted = chat(&app, &ai, &run_id, &request, &forward(&on_event)).await;
    if request.provider == LOCAL_PROVIDER {
        unload_when_idle(app, ai.keep_loaded_minutes);
    }
    chatted
}

async fn chat(
    app: &AppHandle,
    ai: &AiSettings,
    run_id: &str,
    request: &ChatRequest,
    emit: &(dyn Fn(ChatEvent) + Sync),
) -> Result<()> {
    let runs = app.state::<Registry>();
    let run = runs.begin(run_id, BUSY)?;
    let engine = app.state::<Engine>();
    let library = app.state::<LanguageModels>();
    let client = app.state::<reqwest::Client>();
    let Some(connected) = connect(&engine, &library, &client, ai, request, run.token(), emit).await? else {
        return Ok(());
    };
    stream_chat(&client, &connected.endpoint, request, Generation::from(ai), run.token(), emit).await
}

fn unload_when_idle(app: AppHandle, keep_loaded_minutes: u32) {
    if keep_loaded_minutes == 0 {
        return;
    }
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(Duration::from_secs(u64::from(keep_loaded_minutes) * 60)).await;
        if let Ok(settings) = app.state::<SettingsStore>().load() {
            app.state::<Engine>().stop_if_idle(settings.ai.keep_loaded_minutes);
        }
    });
}

#[tauri::command]
pub fn ai_chat_cancel(runs: State<Registry>, run_id: String) {
    runs.cancel(&run_id);
}

#[tauri::command]
pub fn ai_engine(engine: State<Engine>) -> EngineInfo {
    engine.info()
}

#[tauri::command]
pub async fn ai_install_engine(engine: State<'_, Engine>, on_progress: Channel<Progress>) -> Result<bool> {
    engine.install(forward(&on_progress)).await
}

#[tauri::command]
pub fn ai_cancel_engine_install(engine: State<Engine>) {
    engine.cancel_install();
}

#[tauri::command]
pub async fn ai_uninstall_engine(engine: State<'_, Engine>) -> Result<()> {
    engine.uninstall()
}

#[tauri::command]
pub async fn ai_unload_model(engine: State<'_, Engine>) -> Result<()> {
    engine.stop();
    Ok(())
}

#[tauri::command]
pub fn ai_local_models(library: State<LanguageModels>) -> Vec<LanguageModel> {
    library.list()
}

#[tauri::command]
pub async fn ai_download_model(
    library: State<'_, LanguageModels>,
    id: String,
    on_progress: Channel<Progress>,
) -> Result<bool> {
    library.download(&id, forward(&on_progress)).await
}

#[tauri::command]
pub async fn ai_download_model_url(
    library: State<'_, LanguageModels>,
    url: String,
    on_progress: Channel<Progress>,
) -> Result<Option<String>> {
    library.download_url(&url, forward(&on_progress)).await
}

#[tauri::command]
pub fn ai_cancel_model_download(library: State<LanguageModels>, id: String) {
    library.cancel(&id);
}

#[tauri::command]
pub async fn ai_delete_model(library: State<'_, LanguageModels>, engine: State<'_, Engine>, id: String) -> Result<()> {
    if let Ok(path) = library.path(&id) {
        engine.stop_using(&path);
    }
    library.remove(&id)
}

#[tauri::command]
pub async fn ai_download_vision(
    library: State<'_, LanguageModels>,
    id: String,
    on_progress: Channel<Progress>,
) -> Result<bool> {
    library.download_vision(&id, forward(&on_progress)).await
}

#[tauri::command]
pub fn ai_cancel_vision_download(library: State<LanguageModels>, id: String) {
    library.cancel_vision(&id);
}

#[tauri::command]
pub async fn ai_delete_vision(library: State<'_, LanguageModels>, engine: State<'_, Engine>, id: String) -> Result<()> {
    if let Some(path) = library.projector(&id) {
        engine.stop_using(&path);
    }
    library.remove_vision(&id)
}

fn pull_run(provider: &str, model: &str) -> String {
    format!("pull:{provider}:{model}")
}

#[tauri::command]
pub async fn ai_ollama_pull(
    app: AppHandle,
    provider: String,
    model: String,
    on_progress: Channel<Progress>,
) -> Result<bool> {
    let base_url = ollama_url(&app.state::<SettingsStore>(), &provider)?;
    let runs = app.state::<Registry>();
    let run = runs.begin(&pull_run(&provider, &model), BUSY)?;
    let client = app.state::<reqwest::Client>();
    pull_ollama_model(&client, &base_url, model.trim(), run.token(), forward(&on_progress)).await
}

#[tauri::command]
pub fn ai_ollama_cancel_pull(runs: State<Registry>, provider: String, model: String) {
    runs.cancel(&pull_run(&provider, &model));
}

#[tauri::command]
pub async fn ai_ollama_delete(
    settings: State<'_, SettingsStore>,
    client: State<'_, reqwest::Client>,
    provider: String,
    model: String,
) -> Result<()> {
    delete_ollama_model(&client, &ollama_url(&settings, &provider)?, &model).await
}
