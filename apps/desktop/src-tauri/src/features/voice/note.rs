use super::events::{VoiceEvent, VoiceNoteState};
use super::live::LiveTranscript;
use super::recorder::{Purpose, Recorder};
use super::transcriber::Transcriber;
use super::SAMPLE_RATE;
use crate::shared::lock::Lock;
use crate::shared::platform;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread::JoinHandle;
use std::time::Duration;
use tauri::{AppHandle, Manager};

const PREVIEW_GAP: Duration = Duration::from_millis(250);
const LANGUAGE_SAMPLES: usize = 3 * SAMPLE_RATE as usize;

pub struct Recording {
    pub session: u64,
    pub hold: bool,
    pub model: PathBuf,
    pub folder: Option<i64>,
    preview_stopped: Arc<AtomicBool>,
    preview: Option<JoinHandle<Option<&'static str>>>,
}

impl Recording {
    pub fn new(session: u64, hold: bool, model: PathBuf, folder: Option<i64>) -> Self {
        Self {
            session,
            hold,
            model,
            folder,
            preview_stopped: Arc::new(AtomicBool::new(false)),
            preview: None,
        }
    }

    pub fn finish_preview(&mut self) -> Option<&'static str> {
        self.preview.take().and_then(|preview| preview.join().ok()).flatten()
    }
}

#[derive(Default)]
struct Session {
    id: u64,
    recording: Option<Recording>,
    state: VoiceNoteState,
}

#[derive(Default)]
pub struct VoiceNote(Lock<Session>);

impl VoiceNote {
    pub fn begin(&self) -> u64 {
        let mut session = self.0.lock();
        session.id += 1;
        session.state = VoiceNoteState::default();
        session.id
    }

    pub fn is_current(&self, session: u64) -> bool {
        self.0.lock().id == session
    }

    pub fn record(&self, recording: Recording) {
        self.0.lock().recording = Some(recording);
    }

    pub fn end_recording(&self, ends: impl FnOnce(&Recording) -> bool) -> Option<Recording> {
        let recording = self.0.lock().recording.take_if(|recording| ends(recording))?;
        recording.preview_stopped.store(true, Ordering::Relaxed);
        Some(recording)
    }

    pub fn apply_if_current(&self, session: u64, event: &VoiceEvent) -> bool {
        let mut current = self.0.lock();
        if current.id != session {
            return false;
        }
        current.state.apply(event);
        true
    }

    pub fn apply(&self, event: &VoiceEvent) {
        self.0.lock().state.apply(event);
    }

    pub fn state(&self) -> VoiceNoteState {
        self.0.lock().state.clone()
    }
}

pub fn preview_while_recording(app: AppHandle, recording: &mut Recording, show: impl Fn(String) + Send + 'static) {
    let (model, stopped) = (recording.model.clone(), Arc::clone(&recording.preview_stopped));
    recording.preview = Some(std::thread::spawn(move || {
        platform::lower_thread_priority();
        let mut live = LiveTranscript::default();
        let mut language = None;
        while !stopped.load(Ordering::Relaxed) {
            std::thread::sleep(PREVIEW_GAP);
            if stopped.load(Ordering::Relaxed) {
                return language;
            }
            let Some(samples) = app.state::<Recorder>().since(Purpose::VoiceNote, live.chunk_start()) else {
                return language;
            };
            if language.is_none() && samples.len() < LANGUAGE_SAMPLES {
                continue;
            }
            let preview = match app.state::<Transcriber>().preview(&model, &samples, language, Arc::clone(&stopped)) {
                Ok(Some(preview)) => preview,
                Ok(None) => continue,
                Err(error) => {
                    if !stopped.load(Ordering::Relaxed) {
                        eprintln!("[voice] live preview stopped: {error}");
                    }
                    return language;
                }
            };
            if language.is_none() {
                language = preview.language;
            }
            let shown = live.update(samples.len(), &preview.text);
            if !shown.is_empty() && !stopped.load(Ordering::Relaxed) {
                show(shown);
            }
        }
        language
    }));
}

#[cfg(test)]
mod tests {
    use super::super::events::VoiceStatus;
    use super::*;

    #[test]
    fn a_finished_session_cannot_change_the_next_one() {
        let note = VoiceNote::default();
        let first = note.begin();
        let second = note.begin();
        let recording = VoiceEvent::Status(VoiceStatus::Recording { record: None, cancel: None, hold: false });
        assert!(note.apply_if_current(second, &recording));
        let saved = VoiceEvent::Status(VoiceStatus::Saved { id: 1, title: "Voice note".into() });
        assert!(!note.apply_if_current(first, &saved));
        assert!(!note.is_current(first));
        let mut expected = VoiceNoteState::default();
        expected.apply(&recording);
        assert_eq!(note.state(), expected);
    }

    #[test]
    fn ending_a_recording_stops_its_preview() {
        let note = VoiceNote::default();
        note.record(Recording::new(note.begin(), true, PathBuf::new(), None));
        assert!(note.end_recording(|recording| !recording.hold).is_none());
        let ended = note.end_recording(|recording| recording.hold).unwrap();
        assert!(ended.preview_stopped.load(Ordering::Relaxed));
        assert!(note.end_recording(|_| true).is_none());
    }

    #[test]
    fn finishing_returns_the_preview_language_only_for_its_recording() {
        let mut recording = Recording::new(1, false, PathBuf::new(), None);
        recording.preview = Some(std::thread::spawn(|| Some("en")));
        assert_eq!(recording.finish_preview(), Some("en"));
        assert!(recording.preview.is_none());
        assert_eq!(Recording::new(2, false, PathBuf::new(), None).finish_preview(), None);
    }
}
