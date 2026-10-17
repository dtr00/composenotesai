use crate::shared::compression::decompress_bounded;
use std::io::{Error, ErrorKind, Result};
use zstd::bulk::{Compressor, Decompressor};
use zstd::zstd_safe::{get_frame_content_size, CParameter};

const DICTIONARIES: [&[u8]; 2] = [include_bytes!("notes-v1.dict"), include_bytes!("notes-v2.dict")];
pub const CURRENT_DICTIONARY: u32 = DICTIONARIES.len() as u32;
const LEVEL: i32 = 19;
pub const MAX_NOTE_MB: u64 = 64;
pub const MAX_NOTE_BYTES: u64 = MAX_NOTE_MB << 20;

pub struct Codec {
    compressor: Compressor<'static>,
    decompressors: Vec<Decompressor<'static>>,
}

fn invalid(error: impl Into<Box<dyn std::error::Error + Send + Sync>>) -> Error {
    Error::new(ErrorKind::InvalidData, error)
}

fn compressor(dictionary: &[u8]) -> Result<Compressor<'static>> {
    let mut compressor = Compressor::with_dictionary(LEVEL, dictionary)?;
    compressor.set_parameter(CParameter::DictIdFlag(false))?;
    Ok(compressor)
}

impl Codec {
    pub fn new() -> Result<Self> {
        Ok(Self {
            compressor: compressor(DICTIONARIES[DICTIONARIES.len() - 1])?,
            decompressors: DICTIONARIES.map(Decompressor::with_dictionary).into_iter().collect::<Result<_>>()?,
        })
    }

    pub fn compress(&mut self, text: &str) -> Result<Vec<u8>> {
        self.compressor.compress(text.as_bytes())
    }

    pub fn decompress(&mut self, dictionary_id: u32, data: &[u8]) -> Result<String> {
        let decompressor = (dictionary_id as usize)
            .checked_sub(1)
            .and_then(|index| self.decompressors.get_mut(index))
            .ok_or_else(|| invalid(format!("unknown dictionary {dictionary_id}")))?;
        String::from_utf8(decompress_bounded(decompressor, data, MAX_NOTE_BYTES)?).map_err(invalid)
    }
}

pub fn text_size(data: &[u8]) -> u64 {
    get_frame_content_size(data).ok().flatten().unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_text_size_without_decompressing() {
        let mut codec = Codec::new().unwrap();
        let text = "Storage report\n".repeat(10);
        assert_eq!(text_size(&codec.compress(&text).unwrap()), text.len() as u64);
        assert_eq!(text_size(b"not zstd"), 0);
    }

    #[test]
    fn round_trips_text() {
        let mut codec = Codec::new().unwrap();
        let text = "Meeting notes\n\n- ship the storage layer\n- try zstd dictionaries\n";
        let packed = codec.compress(text).unwrap();
        assert_eq!(codec.decompress(CURRENT_DICTIONARY, &packed).unwrap(), text);
    }

    #[test]
    fn compresses_repetitive_text() {
        let mut codec = Codec::new().unwrap();
        let text = "The quick brown fox jumps over the lazy dog. ".repeat(20);
        assert!(codec.compress(&text).unwrap().len() < text.len() / 4);
    }

    #[test]
    fn round_trips_empty_and_unicode() {
        let mut codec = Codec::new().unwrap();
        for text in ["", "naïve café 日本語 🎉"] {
            let packed = codec.compress(text).unwrap();
            assert_eq!(codec.decompress(CURRENT_DICTIONARY, &packed).unwrap(), text);
        }
    }

    #[test]
    fn reads_notes_saved_with_older_dictionaries() {
        let mut codec = Codec::new().unwrap();
        let text = "Older note\n\n- [ ] still readable\n";
        let packed = compressor(DICTIONARIES[0]).unwrap().compress(text.as_bytes()).unwrap();
        assert_eq!(codec.decompress(1, &packed).unwrap(), text);
    }

    #[test]
    fn rejects_unknown_dictionary() {
        let mut codec = Codec::new().unwrap();
        let packed = codec.compress("hi").unwrap();
        for dictionary_id in [0, CURRENT_DICTIONARY + 1] {
            assert!(codec.decompress(dictionary_id, &packed).is_err());
        }
    }

    #[test]
    fn rejects_corrupt_data() {
        let mut codec = Codec::new().unwrap();
        assert!(codec.decompress(CURRENT_DICTIONARY, b"not a zstd frame").is_err());
    }
}
