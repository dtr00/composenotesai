#[cfg(target_os = "linux")]
use crate::shared::error::Error;
use crate::shared::error::Result;
use std::path::PathBuf;

#[cfg(target_os = "linux")]
pub fn copied_image() -> Result<Vec<u8>> {
    let clipboard = gtk::Clipboard::get(&gtk::gdk::SELECTION_CLIPBOARD);
    let Some(image) = clipboard.wait_for_image() else {
        return Ok(Vec::new());
    };
    image.save_to_bufferv("png", &[]).map_err(|error| Error::Message(error.to_string()))
}

#[cfg(not(target_os = "linux"))]
pub fn copied_image() -> Result<Vec<u8>> {
    Ok(Vec::new())
}

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
    #[ignore = "requires a desktop session and replaces the clipboard"]
    fn copied_images_are_encoded_as_png() {
        use gtk::gdk_pixbuf::{Colorspace, Pixbuf};
        gtk::init().unwrap();
        let clipboard = gtk::Clipboard::get(&gtk::gdk::SELECTION_CLIPBOARD);
        let image = Pixbuf::new(Colorspace::Rgb, true, 8, 16, 16).unwrap();
        image.fill(0x3689e6ff);
        clipboard.set_image(&image);
        let bytes = copied_image().unwrap();
        assert!(bytes.starts_with(b"\x89PNG\r\n\x1a\n"));
        let decoded = Pixbuf::from_read(std::io::Cursor::new(bytes)).unwrap();
        assert_eq!(decoded.read_pixel_bytes(), image.read_pixel_bytes());
        clipboard.set_text("Ordinary text");
        assert!(copied_image().unwrap().is_empty());
    }

    #[test]
    fn copied_text_yields_absolute_paths_only() {
        let text = "/home/me/a.png\n  /home/me/b c.jpg \nrelative.png\n\nhello";
        assert_eq!(paths_in(text), [PathBuf::from("/home/me/a.png"), PathBuf::from("/home/me/b c.jpg")]);
    }
}
