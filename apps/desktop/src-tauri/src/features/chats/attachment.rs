use crate::shared::error::{Error, Result};
use serde::Serialize;
use std::fs::File;
use std::io::Read;
use std::path::Path;

const MAX_MB: u64 = 1;
const MAX_BYTES: u64 = MAX_MB << 20;
const SNIFF_BYTES: usize = 8 << 10;

#[derive(Debug, Serialize, PartialEq)]
pub struct TextFile {
    pub name: String,
    pub text: String,
}

fn not_text(name: &str) -> Error {
    Error::Message(format!("“{name}” isn't a text file. You can attach text, Markdown, data and code files."))
}

pub fn read_text_file(path: &Path) -> Result<TextFile> {
    let name = path.file_name().map_or_else(|| path.display().to_string(), |name| name.to_string_lossy().into_owned());
    let mut file = File::open(path)?;
    if file.metadata()?.is_dir() {
        return Err(Error::Message(format!("“{name}” is a folder. Attach the files inside it instead.")));
    }
    let mut bytes = Vec::new();
    file.by_ref().take(MAX_BYTES + 1).read_to_end(&mut bytes)?;
    text_attachment(name, bytes)
}

pub fn text_attachment(name: String, bytes: Vec<u8>) -> Result<TextFile> {
    if bytes.len() as u64 > MAX_BYTES {
        return Err(Error::Message(format!("“{name}” is too big to attach. Files can be up to {MAX_MB} MB.")));
    }
    if bytes[..bytes.len().min(SNIFF_BYTES)].contains(&0) {
        return Err(not_text(&name));
    }
    let text = String::from_utf8(bytes).map_err(|_| not_text(&name))?;
    Ok(TextFile { name, text })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::shared::testing::temp_dir;
    use std::path::PathBuf;

    fn write(dir: &Path, name: &str, bytes: &[u8]) -> PathBuf {
        let path = dir.join(name);
        std::fs::write(&path, bytes).unwrap();
        path
    }

    #[test]
    fn reads_text_files() {
        let dir = temp_dir("attachment-text");
        let path = write(&dir, "notes.md", "# Plan\n- ship".as_bytes());
        assert_eq!(read_text_file(&path).unwrap(), TextFile { name: "notes.md".into(), text: "# Plan\n- ship".into() });
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn checks_attached_bytes_like_files() {
        let attach = |bytes: &[u8]| text_attachment("a.txt".into(), bytes.to_vec()).map_err(|e| e.to_string());
        assert!(attach(&vec![b'a'; (MAX_BYTES + 1) as usize]).unwrap_err().contains("too big"));
        assert!(attach(&[b'a', 0, b'b']).unwrap_err().contains("isn't a text file"));
        assert!(attach(&[b'c', b'a', b'f', 0xe9]).unwrap_err().contains("isn't a text file"));
        assert_eq!(attach("café".as_bytes()), Ok(TextFile { name: "a.txt".into(), text: "café".into() }));
    }

    #[test]
    fn refuses_binary_and_large_files() {
        let dir = temp_dir("attachment-refused");
        let binary = write(&dir, "photo.png", &[0x89, b'P', b'N', b'G', 0, 1, 2]);
        assert!(read_text_file(&binary).unwrap_err().to_string().contains("isn't a text file"));
        let latin1 = write(&dir, "old.txt", &[b'c', b'a', b'f', 0xe9]);
        assert!(read_text_file(&latin1).unwrap_err().to_string().contains("isn't a text file"));
        let large = write(&dir, "big.txt", &vec![b'a'; (MAX_BYTES + 1) as usize]);
        assert!(read_text_file(&large).unwrap_err().to_string().contains("too big"));
        assert!(read_text_file(&dir).unwrap_err().to_string().contains("is a folder"));
        std::fs::remove_dir_all(dir).unwrap();
    }
}
