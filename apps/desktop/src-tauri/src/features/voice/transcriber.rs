use super::MIN_SAMPLES;
use crate::shared::error::{Error, Result};
use crate::shared::lock::Lock;
use crate::shared::text::collapse_whitespace;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, MutexGuard};
use whisper_rs::{get_lang_str, FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

const MAX_THREADS: usize = 8;
const MAX_PREVIEW_THREADS: usize = 4;
const SAMPLES_PER_ENCODER_FRAME: usize = 320;
const AUDIO_CTX_MARGIN: usize = 64;
const FULL_AUDIO_CTX: usize = 1500;

struct Loaded {
    path: PathBuf,
    context: WhisperContext,
}

pub struct Preview {
    pub text: String,
    pub language: Option<&'static str>,
}

struct PreviewOptions {
    language: Option<&'static str>,
    stopped: Arc<AtomicBool>,
}

#[derive(Default)]
pub struct Transcriber(Lock<Option<Loaded>>);

fn whisper(e: whisper_rs::WhisperError) -> Error {
    Error::Message(format!("Couldn't transcribe the recording: {e}"))
}

impl Transcriber {
    pub fn transcribe(&self, model: &Path, samples: &[f32]) -> Result<String> {
        if samples.len() < MIN_SAMPLES {
            return Err(Error::Message("The recording was too short.".into()));
        }
        run(self.0.lock(), model, samples, None).map(|preview| preview.text)
    }

    pub fn preview(
        &self,
        model: &Path,
        samples: &[f32],
        language: Option<&'static str>,
        stopped: Arc<AtomicBool>,
    ) -> Result<Option<Preview>> {
        if samples.len() < MIN_SAMPLES {
            return Ok(None);
        }
        let Some(loaded) = self.0.try_lock() else { return Ok(None) };
        run(loaded, model, samples, Some(PreviewOptions { language, stopped })).map(Some)
    }

    pub fn unload(&self) {
        if let Some(mut loaded) = self.0.try_lock() {
            *loaded = None;
        }
    }
}

fn run(
    mut loaded: MutexGuard<'_, Option<Loaded>>,
    model: &Path,
    samples: &[f32],
    preview: Option<PreviewOptions>,
) -> Result<Preview> {
    whisper_rs::install_logging_hooks();
    if loaded.as_ref().is_none_or(|current| current.path != model) {
        let context =
            WhisperContext::new_with_params(model, WhisperContextParameters::default()).map_err(whisper)?;
        *loaded = Some(Loaded { path: model.to_path_buf(), context });
    }
    let context = &loaded.as_ref().expect("the model was just loaded").context;
    let mut state = context.create_state().map_err(whisper)?;
    let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
    params.set_language(Some(preview.as_ref().and_then(|preview| preview.language).unwrap_or("auto")));
    params.set_translate(false);
    params.set_no_context(true);
    params.set_suppress_blank(true);
    params.set_suppress_nst(true);
    params.set_print_special(false);
    params.set_print_progress(false);
    params.set_print_realtime(false);
    params.set_print_timestamps(false);
    params.set_n_threads(if preview.is_some() { preview_threads() } else { threads() });
    if let Some(PreviewOptions { stopped, .. }) = &preview {
        params.set_audio_ctx(audio_ctx(samples.len()));
        params.set_no_timestamps(true);
        unsafe {
            params.set_abort_callback(Some(stop_requested));
            params.set_abort_callback_user_data(Arc::as_ptr(stopped).cast_mut().cast());
        }
    }
    state.full(params, samples).map_err(whisper)?;
    let segments = state
        .as_iter()
        .map(|segment| segment.to_str_lossy().map(|text| speech_only(&text)).map_err(whisper))
        .collect::<Result<Vec<_>>>()?;
    let text = segments.into_iter().filter(|segment| !segment.is_empty()).collect::<Vec<_>>().join(" ");
    Ok(Preview { text, language: get_lang_str(state.full_lang_id_from_state()) })
}

fn audio_ctx(samples: usize) -> std::ffi::c_int {
    (samples / SAMPLES_PER_ENCODER_FRAME + AUDIO_CTX_MARGIN).min(FULL_AUDIO_CTX) as std::ffi::c_int
}

unsafe extern "C" fn stop_requested(stopped: *mut std::ffi::c_void) -> bool {
    unsafe { (*stopped.cast::<AtomicBool>()).load(Ordering::Relaxed) }
}

fn speech_only(segment: &str) -> String {
    let mut kept = String::new();
    let mut depth = 0_usize;
    for c in segment.chars() {
        match c {
            '[' => depth += 1,
            ']' => depth = depth.saturating_sub(1),
            _ if depth == 0 => kept.push(c),
            _ => {}
        }
    }
    let kept = collapse_whitespace(&kept);
    if kept.starts_with('(') && kept.ends_with(')') {
        String::new()
    } else {
        kept
    }
}

fn available_threads() -> usize {
    std::thread::available_parallelism().map_or(4, usize::from)
}

fn threads() -> std::ffi::c_int {
    available_threads().clamp(1, MAX_THREADS) as std::ffi::c_int
}

fn preview_threads() -> std::ffi::c_int {
    (available_threads() / 4).clamp(1, MAX_PREVIEW_THREADS) as std::ffi::c_int
}

#[cfg(test)]
mod tests {
    use super::*;

    fn wav_samples(path: &str) -> Vec<f32> {
        let bytes = std::fs::read(path).unwrap();
        bytes[44..].as_chunks::<2>().0.iter().map(|pair| f32::from(i16::from_le_bytes(*pair)) / 32768.0).collect()
    }

    #[test]
    fn non_speech_markers_are_dropped() {
        assert_eq!(speech_only(" [BLANK_AUDIO]"), "");
        assert_eq!(speech_only("(upbeat music)"), "");
        assert_eq!(speech_only("[Music] Hi there."), "Hi there.");
        assert_eq!(speech_only("Buy milk [BLANK_AUDIO] and eggs"), "Buy milk and eggs");
    }

    #[test]
    fn speech_is_kept() {
        assert_eq!(speech_only(" Call the dentist (before noon) please."), "Call the dentist (before noon) please.");
        assert_eq!(speech_only("Unbalanced ] bracket"), "Unbalanced bracket");
    }

    #[test]
    fn rejects_recordings_that_are_too_short() {
        let result = Transcriber::default().transcribe(Path::new("missing.bin"), &[0.0; 100]);
        assert!(matches!(result, Err(Error::Message(message)) if message.contains("too short")));
    }

    #[test]
    fn previews_wait_for_enough_audio_and_a_free_transcriber() {
        let transcriber = Transcriber::default();
        let stopped = Arc::new(AtomicBool::new(false));
        let missing = Path::new("missing.bin");
        assert!(matches!(transcriber.preview(missing, &[0.0; 100], None, Arc::clone(&stopped)), Ok(None)));
        let busy = transcriber.0.lock();
        assert!(matches!(transcriber.preview(missing, &[0.0; MIN_SAMPLES], None, Arc::clone(&stopped)), Ok(None)));
        drop(busy);
        assert!(transcriber.preview(missing, &[0.0; MIN_SAMPLES], None, stopped).is_err());
    }

    #[test]
    #[ignore = "needs WHISPER_TEST_MODEL (a ggml file) and WHISPER_TEST_WAV (16 kHz mono 16-bit)"]
    fn transcribes_speech() {
        let model = std::env::var("WHISPER_TEST_MODEL").unwrap();
        let wav = std::env::var("WHISPER_TEST_WAV").unwrap();
        let text = Transcriber::default().transcribe(Path::new(&model), &wav_samples(&wav)).unwrap();
        assert!(text.to_lowercase().contains("ask not what your country can do for you"));
    }

    #[test]
    #[ignore = "needs WHISPER_TEST_MODEL (a ggml file)"]
    fn silence_transcribes_to_nothing() {
        let model = std::env::var("WHISPER_TEST_MODEL").unwrap();
        let silence = vec![0.0; 3 * super::super::SAMPLE_RATE as usize];
        assert_eq!(Transcriber::default().transcribe(Path::new(&model), &silence).unwrap(), "");
    }

    #[test]
    #[ignore = "needs WHISPER_TEST_MODEL (a ggml file) and WHISPER_TEST_WAV (16 kHz mono 16-bit)"]
    fn previews_keep_transcribing_until_stopped() {
        let model = std::env::var("WHISPER_TEST_MODEL").unwrap();
        let samples = wav_samples(&std::env::var("WHISPER_TEST_WAV").unwrap());
        let transcriber = Transcriber::default();
        let stopped = Arc::new(AtomicBool::new(false));
        for _ in 0..3 {
            assert!(transcriber.preview(Path::new(&model), &samples, None, Arc::clone(&stopped)).unwrap().is_some());
        }
        stopped.store(true, Ordering::Relaxed);
        assert!(transcriber.preview(Path::new(&model), &samples, Some("en"), stopped).is_err());
    }
}
