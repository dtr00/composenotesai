use std::io;
use std::path::PathBuf;

const WEB_CACHES: &[&str] = &["WebKitCache", "EBWebView/Default/Cache", "EBWebView/Default/Code Cache"];

pub fn clear_web_caches(data_dirs: &[PathBuf]) {
    for cache in data_dirs.iter().flat_map(|dir| WEB_CACHES.iter().map(move |cache| dir.join(cache))) {
        match std::fs::remove_dir_all(&cache) {
            Err(error) if error.kind() != io::ErrorKind::NotFound => {
                eprintln!("[storage] couldn't clear the web view cache {}: {error}", cache.display());
            }
            _ => {}
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::shared::testing::temp_dir;

    #[test]
    fn clears_web_caches_and_keeps_site_data() {
        let dir = temp_dir("storage-caches");
        std::fs::create_dir_all(dir.join("WebKitCache/Version 17")).unwrap();
        std::fs::create_dir_all(dir.join("EBWebView/Default/Cache")).unwrap();
        std::fs::create_dir_all(dir.join("EBWebView/Default/Network")).unwrap();
        std::fs::write(dir.join("cookies"), [0u8; 4]).unwrap();
        clear_web_caches(&[dir.clone(), dir.join("missing")]);
        assert!(!dir.join("WebKitCache").exists());
        assert!(!dir.join("EBWebView/Default/Cache").exists());
        assert!(dir.join("EBWebView/Default/Network").exists());
        assert!(dir.join("cookies").exists());
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
