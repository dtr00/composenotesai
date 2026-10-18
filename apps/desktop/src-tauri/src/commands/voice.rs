use crate::features::settings::{Settings, SettingsStore, VoiceShortcutSettings};
use crate::features::speech_models::{SpeechModel, SpeechModels};
use crate::features::voice::{
    list_microphones, Level, Microphone, Purpose, Recorder, Transcriber, VoiceNote, VoiceNoteState, SAMPLE_RATE,
};
use crate::features::voice_shortcuts::{self, Binding, ShortcutInfo};
use crate::shared::download::Progress;
use crate::shared::error::{Error, Result};
use crate::shared::ipc::forward;
use serde::Serialize;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::ipc::Channel;
use tauri::{AppHandle, Manager, State};

mod note;
pub mod overlay;

pub use note::on_shortcut;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TestResult {
    seconds: f32,
}

const NO_SPEECH_MODEL: &str = "No speech model is installed. Download one in Settings > Voice.";

fn speech_model(models: &SpeechModels, settings: &Settings) -> Result<PathBuf> {
    models.usable_path(settings.voice_model.as_deref()).ok_or_else(|| Error::Message(NO_SPEECH_MODEL.into()))
}

fn send_levels(channel: Channel<f32>) -> Level {
    Arc::new(move |peak| {
        let _ = channel.send(peak);
    })
}

#[tauri::command]
pub fn voice_note_state(note: State<VoiceNote>) -> VoiceNoteState {
    note.state()
}

#[tauri::command]
pub async fn microphones() -> Result<Vec<Microphone>> {
    list_microphones()
}

#[tauri::command]
pub async fn voice_test_start(
    settings: State<'_, SettingsStore>,
    recorder: State<'_, Recorder>,
    on_level: Channel<f32>,
) -> Result<()> {
    recorder.start(Purpose::MicTest, settings.load()?.mic_device, Some(send_levels(on_level)))
}

#[tauri::command]
pub async fn voice_test_stop(recorder: State<'_, Recorder>) -> Result<TestResult> {
    let samples = recorder.stop(Purpose::MicTest)?;
    Ok(TestResult { seconds: samples.len() as f32 / SAMPLE_RATE as f32 })
}

#[tauri::command]
pub async fn voice_dictation_start(
    settings: State<'_, SettingsStore>,
    models: State<'_, SpeechModels>,
    recorder: State<'_, Recorder>,
    on_level: Channel<f32>,
) -> Result<()> {
    let settings = settings.load()?;
    speech_model(&models, &settings)?;
    recorder.start(Purpose::Dictation, settings.mic_device, Some(send_levels(on_level)))
}

#[tauri::command]
pub async fn voice_dictation_stop(app: AppHandle) -> Result<String> {
    let samples = app.state::<Recorder>().stop(Purpose::Dictation)?;
    let model = speech_model(&app.state::<SpeechModels>(), &app.state::<SettingsStore>().load()?)?;
    tauri::async_runtime::spawn_blocking(move || app.state::<Transcriber>().transcribe(&model, &samples, None))
        .await
        .map_err(|_| Error::Message("Transcription stopped unexpectedly.".into()))?
}

#[tauri::command]
pub async fn voice_dictation_cancel(app: AppHandle) {
    let _ = app.state::<Recorder>().stop(Purpose::Dictation);
}

#[tauri::command]
pub fn voice_shortcuts(app: AppHandle) -> ShortcutInfo {
    voice_shortcuts::info(&app)
}

#[tauri::command]
pub async fn set_up_voice_shortcuts(app: AppHandle, settings: State<'_, SettingsStore>) -> Result<ShortcutInfo> {
    voice_shortcuts::set_up(&app).await?;
    let saved = settings.voice_shortcuts()?;
    settings.save_voice_shortcuts(&VoiceShortcutSettings { set_up: true, ..saved })?;
    Ok(voice_shortcuts::info(&app))
}

#[tauri::command]
pub async fn set_voice_shortcut(
    app: AppHandle,
    settings: State<'_, SettingsStore>,
    binding: Binding,
    hotkey: Option<String>,
) -> Result<ShortcutInfo> {
    voice_shortcuts::change(&app, binding, hotkey.as_deref()).await?;
    let mut saved = settings.voice_shortcuts()?;
    match binding {
        Binding::Record => saved.record = hotkey,
        Binding::Cancel => saved.cancel = hotkey,
    }
    settings.save_voice_shortcuts(&saved)?;
    Ok(voice_shortcuts::info(&app))
}

#[tauri::command]
pub fn voice_models(models: State<SpeechModels>) -> Vec<SpeechModel> {
    models.list()
}

#[tauri::command]
pub async fn download_voice_model(
    models: State<'_, SpeechModels>,
    id: String,
    on_progress: Channel<Progress>,
) -> Result<bool> {
    models.download(&id, forward(&on_progress)).await
}

#[tauri::command]
pub fn cancel_voice_model_download(models: State<SpeechModels>, id: String) {
    models.cancel(&id);
}

#[tauri::command]
pub async fn delete_voice_model(models: State<'_, SpeechModels>, id: String) -> Result<()> {
    models.remove(&id)
}
