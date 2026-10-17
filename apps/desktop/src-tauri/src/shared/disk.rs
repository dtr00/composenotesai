use std::collections::HashSet;
use std::fs::Metadata;
use std::path::Path;

pub fn file_bytes(path: &Path) -> u64 {
    std::fs::symlink_metadata(path).map_or(0, |metadata| metadata.len())
}

pub fn folder_bytes(path: &Path) -> u64 {
    DiskUsage::default().measure(path)
}

#[derive(Default)]
pub struct DiskUsage {
    seen: HashSet<(u64, u64)>,
}

impl DiskUsage {
    #[cfg(unix)]
    fn first_sighting(&mut self, metadata: &Metadata) -> bool {
        use std::os::unix::fs::MetadataExt;
        metadata.nlink() <= 1 || self.seen.insert((metadata.dev(), metadata.ino()))
    }

    #[cfg(not(unix))]
    fn first_sighting(&mut self, _metadata: &Metadata) -> bool {
        true
    }

    pub fn measure(&mut self, path: &Path) -> u64 {
        let Ok(metadata) = std::fs::symlink_metadata(path) else { return 0 };
        if metadata.is_file() {
            return if self.first_sighting(&metadata) { metadata.len() } else { 0 };
        }
        if !metadata.is_dir() {
            return 0;
        }
        let Ok(entries) = std::fs::read_dir(path) else { return 0 };
        entries.flatten().map(|entry| self.measure(&entry.path())).sum()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::shared::testing::temp_dir;

    #[test]
    fn measures_files_and_nested_folders() {
        let dir = temp_dir("disk-measure");
        std::fs::write(dir.join("a"), [0u8; 10]).unwrap();
        std::fs::create_dir_all(dir.join("nested/deeper")).unwrap();
        std::fs::write(dir.join("nested/deeper/b"), [0u8; 25]).unwrap();
        assert_eq!(file_bytes(&dir.join("a")), 10);
        assert_eq!(folder_bytes(&dir), 35);
        assert_eq!(folder_bytes(&dir.join("missing")), 0);
        assert_eq!(file_bytes(&dir.join("missing")), 0);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn counts_hard_linked_files_once() {
        let dir = temp_dir("disk-links");
        std::fs::write(dir.join("blob"), [0u8; 40]).unwrap();
        std::fs::create_dir_all(dir.join("records")).unwrap();
        std::fs::hard_link(dir.join("blob"), dir.join("records/link")).unwrap();
        assert_eq!(folder_bytes(&dir), 40);
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
