use serde::{Deserialize, Serialize};
use std::time::Duration;
use tauri::{Emitter, Runtime};

const SAVED_LINGER: Duration = Duration::from_millis(2500);
const CANCELLED_LINGER: Duration = Duration::from_millis(1500);
const FAILED_LINGER: Duration = Duration::from_secs(6);

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "state", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum VoiceStatus {
    Recording { record: Option<String>, cancel: Option<String>, hold: bool },
    Transcribing,
    Saved { id: i64, title: String },
    Cancelled,
    Failed { message: String },
}

impl VoiceStatus {
    pub fn overlay_linger(&self) -> Option<Duration> {
        match self {
            VoiceStatus::Recording { .. } | VoiceStatus::Transcribing => None,
            VoiceStatus::Saved { .. } => Some(SAVED_LINGER),
            VoiceStatus::Cancelled => Some(CANCELLED_LINGER),
            VoiceStatus::Failed { .. } => Some(FAILED_LINGER),
        }
    }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "event", content = "payload")]
pub enum VoiceEvent {
    #[serde(rename = "voice-status")]
    Status(VoiceStatus),
    #[serde(rename = "voice-preview")]
    Preview(String),
    #[serde(rename = "voice-level")]
    Level(f32),
}

impl VoiceEvent {
    pub fn name(&self) -> &'static str {
        match self {
            VoiceEvent::Status(_) => "voice-status",
            VoiceEvent::Preview(_) => "voice-preview",
            VoiceEvent::Level(_) => "voice-level",
        }
    }

    pub fn emit<R: Runtime>(&self, emitter: &impl Emitter<R>) -> tauri::Result<()> {
        match self {
            VoiceEvent::Status(status) => emitter.emit(self.name(), status),
            VoiceEvent::Preview(text) => emitter.emit(self.name(), text),
            VoiceEvent::Level(peak) => emitter.emit(self.name(), peak),
        }
    }
}

#[derive(Clone, Debug, Default, PartialEq, Serialize)]
pub struct VoiceNoteState {
    status: Option<VoiceStatus>,
    preview: String,
}

impl VoiceNoteState {
    pub fn apply(&mut self, event: &VoiceEvent) {
        match event {
            VoiceEvent::Status(status) => self.status = Some(status.clone()),
            VoiceEvent::Preview(text) => self.preview.clone_from(text),
            VoiceEvent::Level(_) => {}
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn events_round_trip_under_their_names() {
        let events = [
            VoiceEvent::Status(VoiceStatus::Recording { record: Some("mod+alt+r".into()), cancel: None, hold: true }),
            VoiceEvent::Status(VoiceStatus::Saved { id: 3, title: "Voice note".into() }),
            VoiceEvent::Preview("hello there".into()),
            VoiceEvent::Level(0.5),
        ];
        for event in events {
            let line = serde_json::to_string(&event).unwrap();
            let value: serde_json::Value = serde_json::from_str(&line).unwrap();
            assert_eq!(value["event"], event.name());
            assert_eq!(serde_json::from_str::<VoiceEvent>(&line).unwrap(), event);
        }
    }

    #[test]
    fn state_keeps_the_latest_status_and_preview() {
        let mut state = VoiceNoteState::default();
        state.apply(&VoiceEvent::Status(VoiceStatus::Transcribing));
        state.apply(&VoiceEvent::Preview("first words".into()));
        state.apply(&VoiceEvent::Level(0.8));
        assert_eq!(state.status, Some(VoiceStatus::Transcribing));
        assert_eq!(state.preview, "first words");
    }
}
