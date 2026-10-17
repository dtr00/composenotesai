use std::io::{Error, ErrorKind, Result};
use zstd::bulk::Decompressor;
use zstd::zstd_safe::get_frame_content_size;

pub fn decompress_bounded(decompressor: &mut Decompressor<'_>, data: &[u8], max_bytes: u64) -> Result<Vec<u8>> {
    let size = get_frame_content_size(data)
        .ok()
        .flatten()
        .filter(|&size| size <= max_bytes)
        .ok_or_else(|| Error::new(ErrorKind::InvalidData, "missing or oversized content size"))?;
    decompressor.decompress(data, size as usize)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decompresses_frames_within_the_limit_only() {
        let packed = zstd::bulk::compress(&[7u8; 100], 3).unwrap();
        let mut decompressor = Decompressor::new().unwrap();
        assert_eq!(decompress_bounded(&mut decompressor, &packed, 100).unwrap(), [7u8; 100]);
        assert!(decompress_bounded(&mut decompressor, &packed, 99).is_err());
        assert!(decompress_bounded(&mut decompressor, b"not zstd", 100).is_err());
    }
}
