use std::path::PathBuf;

#[cfg(target_os = "linux")]
fn paths_in(text: &str) -> Vec<PathBuf> {
    text.lines().map(str::trim).filter(|line| line.starts_with('/')).map(PathBuf::from).collect()
}

#[cfg(target_os = "linux")]
pub fn copied_files() -> Vec<PathBuf> {
    use gtk::{gdk, glib};
    let clipboard = gtk::Clipboard::get(&gdk::SELECTION_CLIPBOARD);
    let from_uris: Vec<PathBuf> = clipboard
        .wait_for_uris()
        .iter()
        .filter_map(|uri| glib::filename_from_uri(uri).ok().map(|(path, _)| path))
        .collect();
    if !from_uris.is_empty() {
        return from_uris;
    }
    clipboard.wait_for_text().map(|text| paths_in(&text)).unwrap_or_default()
}

#[cfg(not(target_os = "linux"))]
pub fn copied_files() -> Vec<PathBuf> {
    Vec::new()
}

#[cfg(all(test, target_os = "linux"))]
mod tests {
    use super::*;

    #[test]
    fn copied_text_yields_absolute_paths_only() {
        let text = "/home/me/a.png\n  /home/me/b c.jpg \nrelative.png\n\nhello";
        assert_eq!(paths_in(text), [PathBuf::from("/home/me/a.png"), PathBuf::from("/home/me/b c.jpg")]);
    }
}
