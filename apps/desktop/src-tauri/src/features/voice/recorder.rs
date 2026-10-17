use super::devices::{self, audio};
use super::resample::to_rate;
use super::SAMPLE_RATE;
use crate::shared::error::{Error, Result};
use crate::shared::lock::Lock;
use cpal::traits::{DeviceTrait, StreamTrait};
use cpal::{
    BufferSize, FromSample, SampleFormat, SizedSample, Stream, StreamConfig, SupportedBufferSize, SupportedStreamConfig,
};
use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::Arc;
use std::thread::JoinHandle;
use std::time::Duration;

const MAX_SECONDS: usize = 600;
const LEVEL_RATE: u32 = 20;
const START_TIMEOUT: Duration = Duration::from_secs(5);

pub type Level = Arc<dyn Fn(f32) + Send + Sync>;

type Buffer = Arc<Lock<Vec<f32>>>;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Purpose {
    VoiceNote,
    Dictation,
    MicTest,
}

impl Purpose {
    fn busy(self) -> Error {
        Error::Message(
            match self {
                Purpose::VoiceNote => "The microphone is recording a voice note.",
                Purpose::Dictation => "The microphone is busy with dictation.",
                Purpose::MicTest => "The microphone is busy with the microphone test.",
            }
            .into(),
        )
    }
}

struct Session {
    purpose: Purpose,
    stop: Sender<()>,
    samples: JoinHandle<Vec<f32>>,
    buffer: Buffer,
    rate: u32,
}

#[derive(Default)]
pub struct Recorder(Lock<Option<Session>>);

impl Recorder {
    pub fn start(&self, purpose: Purpose, device: Option<String>, on_level: Option<Level>) -> Result<()> {
        let mut active = self.0.lock();
        if let Some(session) = active.as_ref() {
            return Err(session.purpose.busy());
        }
        let (ready_tx, ready_rx) = mpsc::channel();
        let (stop_tx, stop_rx) = mpsc::channel();
        let buffer = Buffer::default();
        let captured = Arc::clone(&buffer);
        let samples = std::thread::spawn(move || capture(device, on_level, captured, ready_tx, stop_rx));
        match ready_rx.recv_timeout(START_TIMEOUT) {
            Ok(Ok(rate)) => {
                *active = Some(Session { purpose, stop: stop_tx, samples, buffer, rate });
                Ok(())
            }
            Ok(Err(e)) => Err(e),
            Err(_) => Err(Error::Message("The microphone didn't start in time.".into())),
        }
    }

    pub fn is_recording(&self) -> bool {
        self.0.lock().is_some()
    }

    pub fn stop(&self, purpose: Purpose) -> Result<Vec<f32>> {
        let session = self.0.lock().take_if(|session| session.purpose == purpose);
        let session = session.ok_or_else(|| Error::Message("Not recording.".into()))?;
        let _ = session.stop.send(());
        session.samples.join().map_err(|_| Error::Message("The recorder stopped unexpectedly.".into()))
    }

    pub fn since(&self, purpose: Purpose, offset: usize) -> Option<Vec<f32>> {
        let (tail, rate) = {
            let active = self.0.lock();
            let session = active.as_ref().filter(|session| session.purpose == purpose)?;
            let buffer = session.buffer.lock();
            let start = (offset as u64 * u64::from(session.rate) / u64::from(SAMPLE_RATE)) as usize;
            (buffer.get(start..).unwrap_or_default().to_vec(), session.rate)
        };
        Some(to_rate(&tail, rate, SAMPLE_RATE))
    }
}

fn capture(
    device: Option<String>,
    on_level: Option<Level>,
    buffer: Buffer,
    ready: Sender<Result<u32>>,
    stop: Receiver<()>,
) -> Vec<f32> {
    let (stream, rate) = match open(device.as_deref(), on_level, &buffer) {
        Ok(opened) => opened,
        Err(e) => {
            let _ = ready.send(Err(e));
            return Vec::new();
        }
    };
    let _ = ready.send(Ok(rate));
    let _ = stop.recv();
    drop(stream);
    let samples = std::mem::take(&mut *buffer.lock());
    to_rate(&samples, rate, SAMPLE_RATE)
}

fn open(device: Option<&str>, on_level: Option<Level>, buffer: &Buffer) -> Result<(Stream, u32)> {
    let device = devices::find(device)?;
    let supported = preferred_config(&device)?;
    let mut config: StreamConfig = supported.config();
    config.buffer_size = chunk_size(supported.buffer_size(), config.sample_rate);
    let rate = config.sample_rate;
    let channels = usize::from(config.channels);
    let limit = MAX_SECONDS * rate as usize;
    let stream = match supported.sample_format() {
        SampleFormat::F32 => build::<f32>(&device, config, channels, limit, on_level, buffer),
        SampleFormat::I16 => build::<i16>(&device, config, channels, limit, on_level, buffer),
        SampleFormat::I32 => build::<i32>(&device, config, channels, limit, on_level, buffer),
        SampleFormat::U16 => build::<u16>(&device, config, channels, limit, on_level, buffer),
        other => Err(Error::Message(format!("This microphone's audio format ({other}) isn't supported."))),
    }?;
    stream.play().map_err(audio)?;
    Ok((stream, rate))
}

fn chunk_size(supported: &SupportedBufferSize, rate: u32) -> BufferSize {
    match *supported {
        SupportedBufferSize::Range { min, max } => BufferSize::Fixed((rate / LEVEL_RATE).clamp(min, max)),
        SupportedBufferSize::Unknown => BufferSize::Default,
    }
}

fn preferred_config(device: &cpal::Device) -> Result<SupportedStreamConfig> {
    let default = device.default_input_config().map_err(audio)?;
    let (rate, channels) = (default.sample_rate(), default.channels());
    let as_float = device.supported_input_configs().ok().and_then(|mut configs| {
        configs.find(|range| {
            range.sample_format() == SampleFormat::F32
                && range.channels() == channels
                && (range.min_sample_rate()..=range.max_sample_rate()).contains(&rate)
        })
    });
    Ok(as_float.map_or(default, |range| range.with_sample_rate(rate)))
}

fn build<T>(
    device: &cpal::Device,
    config: StreamConfig,
    channels: usize,
    limit: usize,
    on_level: Option<Level>,
    buffer: &Buffer,
) -> Result<Stream>
where
    T: SizedSample,
    f32: FromSample<T>,
{
    let buffer = Arc::clone(buffer);
    let level_every = (config.sample_rate / LEVEL_RATE) as usize;
    let mut peak = 0.0_f32;
    let mut since_level = 0;
    device
        .build_input_stream(
            config,
            move |data: &[T], _| {
                let mut peaks = Vec::new();
                let mut samples = buffer.lock();
                for frame in data.chunks_exact(channels) {
                    if samples.len() >= limit {
                        break;
                    }
                    let sum: f32 = frame.iter().map(|&s| s.to_sample::<f32>()).sum();
                    let sample = sum / channels as f32;
                    samples.push(sample);
                    peak = peak.max(sample.abs());
                    since_level += 1;
                    if since_level >= level_every {
                        peaks.push(peak);
                        peak = 0.0;
                        since_level = 0;
                    }
                }
                drop(samples);
                if let Some(on_level) = &on_level {
                    for peak in peaks {
                        on_level(peak);
                    }
                }
            },
            |e| eprintln!("[voice] microphone error: {e}"),
            None,
        )
        .map_err(audio)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn audio_arrives_in_small_chunks_within_the_device_range() {
        let range = |min, max| SupportedBufferSize::Range { min, max };
        assert_eq!(chunk_size(&range(64, 96_000), 48_000), BufferSize::Fixed(2_400));
        assert_eq!(chunk_size(&range(4_096, 8_192), 48_000), BufferSize::Fixed(4_096));
        assert_eq!(chunk_size(&range(64, 1_024), 48_000), BufferSize::Fixed(1_024));
        assert_eq!(chunk_size(&SupportedBufferSize::Unknown, 48_000), BufferSize::Default);
    }
}
