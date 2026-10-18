use super::speech_model;
use crate::features::notes::{NoteStore, NoteSummary};
use crate::features::settings::SettingsStore;
use crate::features::speech_models::SpeechModels;
use crate::features::voice::{
    preview_while_recording, Level, Purpose, Recorder, Recording, Transcriber, VoiceEvent, VoiceNote, VoiceStatus,
    MIN_SAMPLES,
};
use crate::features::voice_shortcuts::{self, Binding, ShortcutEvent};
use crate::features::windows;
use crate::shared::error::{Error, Result};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

const VOICE_NOTE_TITLE: &str = "Voice note";
const SAVED_EVENT: &str = "voice-note-saved";

fn announce(app: &AppHandle, session: u64, status: VoiceStatus) {
    let linger = status.overlay_linger();
    if emit(app, session, VoiceEvent::Status(status)) {
        if let Some(linger) = linger {
            close_overlay_after(app, session, linger);
        }
    }
}

fn emit(app: &AppHandle, session: u64, event: VoiceEvent) -> bool {
    if !app.state::<VoiceNote>().apply_if_current(session, &event) {
        return false;
    }
    windows::relay_to_overlay(app, &event);
    let _ = event.emit(app);
    true
}

fn close_overlay_after(app: &AppHandle, session: u64, linger: Duration) {
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(linger).await;
        if app.state::<VoiceNote>().is_current(session) {
            windows::close_voice_overlay(&app);
        }
    });
}

fn announce_level(app: &AppHandle, session: u64) -> Level {
    let app = app.clone();
    Arc::new(move |peak| {
        emit(&app, session, VoiceEvent::Level(peak));
    })
}

fn save_voice_note(app: &AppHandle, recording: &mut Recording, samples: &[f32]) -> Result<NoteSummary> {
    let language = recording.finish_preview();
    let text = app.state::<Transcriber>().transcribe(&recording.model, samples, language)?;
    if text.is_empty() {
        return Err(Error::Message("No speech was detected.".into()));
    }
    let notes = app.state::<NoteStore>();
    let note = match notes.create(recording.folder, Some(VOICE_NOTE_TITLE)) {
        Err(Error::NotFound(..)) => notes.create(None, Some(VOICE_NOTE_TITLE))?,
        created => created?,
    };
    notes.save(note.id, &text)?;
    Ok(note)
}

fn transcribe_in_background(app: AppHandle, mut recording: Recording, samples: Vec<f32>) {
    std::thread::spawn(move || {
        let status = match save_voice_note(&app, &mut recording, &samples) {
            Ok(note) => {
                let _ = app.emit(SAVED_EVENT, note.id);
                VoiceStatus::Saved { id: note.id, title: note.title }
            }
            Err(e) => VoiceStatus::Failed { message: e.to_string() },
        };
        announce(&app, recording.session, status);
    });
}

fn start_recording(app: &AppHandle, session: u64) -> Result<()> {
    let settings = app.state::<SettingsStore>().load()?;
    if windows::main_window_in_front(app) {
        windows::close_voice_overlay(app);
    } else if let Err(e) = windows::show_voice_overlay(app, &settings) {
        eprintln!("[voice] couldn't show the recording overlay: {e}");
    }
    let model = speech_model(&app.state::<SpeechModels>(), &settings)?;
    let level = announce_level(app, session);
    app.state::<Recorder>().start(Purpose::VoiceNote, settings.mic_device.clone(), Some(level))?;
    let hold = settings.hold_to_record;
    let mut recording = Recording::new(session, hold, model, settings.voice_folder_id);
    let preview = app.clone();
    preview_while_recording(app.clone(), &mut recording, move |text| {
        emit(&preview, session, VoiceEvent::Preview(text));
    });
    app.state::<VoiceNote>().record(recording);
    let cancel = if hold {
        None
    } else {
        voice_shortcuts::grab_cancel(app);
        voice_shortcuts::hotkey(app, Binding::Cancel)
    };
    let record = voice_shortcuts::hotkey(app, Binding::Record);
    announce(app, session, VoiceStatus::Recording { record, cancel, hold });
    Ok(())
}

fn stop_recording(app: &AppHandle, recording: &Recording) -> Option<Vec<f32>> {
    voice_shortcuts::release_cancel(app);
    match app.state::<Recorder>().stop(Purpose::VoiceNote) {
        Ok(samples) => Some(samples),
        Err(e) => {
            announce(app, recording.session, VoiceStatus::Failed { message: e.to_string() });
            None
        }
    }
}

fn finish_recording(app: &AppHandle, recording: Recording) {
    let Some(samples) = stop_recording(app, &recording) else {
        return;
    };
    if samples.len() < MIN_SAMPLES {
        return announce(app, recording.session, VoiceStatus::Cancelled);
    }
    announce(app, recording.session, VoiceStatus::Transcribing);
    transcribe_in_background(app.clone(), recording, samples);
}

fn toggle_recording(app: &AppHandle) {
    let note = app.state::<VoiceNote>();
    if let Some(recording) = note.end_recording(|_| true) {
        return finish_recording(app, recording);
    }
    let session = note.begin();
    if let Err(e) = start_recording(app, session) {
        announce(app, session, VoiceStatus::Failed { message: e.to_string() });
    }
}

fn release_recording(app: &AppHandle) {
    if let Some(recording) = app.state::<VoiceNote>().end_recording(|recording| recording.hold) {
        finish_recording(app, recording);
    }
}

fn cancel_recording(app: &AppHandle) {
    let Some(recording) = app.state::<VoiceNote>().end_recording(|recording| !recording.hold) else {
        return;
    };
    if stop_recording(app, &recording).is_some() {
        announce(app, recording.session, VoiceStatus::Cancelled);
    }
}

pub fn on_shortcut(app: &AppHandle, event: ShortcutEvent) {
    match event {
        ShortcutEvent::Record => toggle_recording(app),
        ShortcutEvent::ReleaseRecord => release_recording(app),
        ShortcutEvent::Cancel => cancel_recording(app),
    }
}
