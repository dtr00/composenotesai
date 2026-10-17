mod devices;
mod events;
mod live;
mod note;
mod recorder;
mod resample;
mod transcriber;

pub use devices::{list_microphones, Microphone};
pub use events::{VoiceEvent, VoiceNoteState, VoiceStatus};
pub use note::{preview_while_recording, Recording, VoiceNote};
pub use recorder::{Level, Purpose, Recorder};
pub use transcriber::Transcriber;

pub const SAMPLE_RATE: u32 = 16_000;
pub const MIN_SAMPLES: usize = SAMPLE_RATE as usize / 2;
