use crate::entities::media::{is_supported_image, unsupported_image};
use crate::shared::error::Result;
use std::path::{Path, PathBuf};

const FILE_NAME: &str = "panel-background";

pub fn background_path(data_dir: &Path) -> PathBuf {
    data_dir.join(FILE_NAME)
}

pub fn load(data_dir: &Path) -> Result<Vec<u8>> {
    match std::fs::read(background_path(data_dir)) {
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(Vec::new()),
        result => Ok(result?),
    }
}

pub fn save(data_dir: &Path, bytes: &[u8]) -> Result<()> {
    if !is_supported_image(bytes) {
        return Err(unsupported_image());
    }
    std::fs::write(background_path(data_dir), bytes)?;
    Ok(())
}

pub fn clear(data_dir: &Path) -> Result<()> {
    match std::fs::remove_file(background_path(data_dir)) {
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        result => Ok(result?),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::shared::testing::temp_dir;

    #[test]
    fn saves_loads_and_clears_the_background() {
        let dir = temp_dir("panel-background-roundtrip");
        let png = b"\x89PNG\r\n\x1a\nimage".to_vec();
        assert!(load(&dir).unwrap().is_empty());
        save(&dir, &png).unwrap();
        assert_eq!(load(&dir).unwrap(), png);
        clear(&dir).unwrap();
        assert!(load(&dir).unwrap().is_empty());
        clear(&dir).unwrap();
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn rejects_files_that_are_not_images() {
        let dir = temp_dir("panel-background-reject");
        assert_eq!(save(&dir, b"#!/bin/sh").unwrap_err().to_string(), unsupported_image().to_string());
        assert!(load(&dir).unwrap().is_empty());
        std::fs::remove_dir_all(dir).unwrap();
    }
}
