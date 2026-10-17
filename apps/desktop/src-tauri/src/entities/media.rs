use crate::shared::error::Error;
use serde::Serialize;

pub const SNIFF_BYTES: usize = 64;

const MB: u64 = 1024 * 1024;
const MAX_IMAGE_BYTES: u64 = 25 * MB;
const MAX_VIDEO_BYTES: u64 = 512 * MB;
const MAX_DOCUMENT_BYTES: u64 = 100 * MB;
const MATROSKA: &[u8] = b"\x1a\x45\xdf\xa3";
const AUDIO_BRANDS: [&[u8]; 3] = [b"M4A ", b"M4B ", b"M4P "];
const ZIP: &[u8] = b"PK\x03\x04";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum MediaType {
    Image,
    Video,
    Document,
}

impl MediaType {
    pub fn noun(self) -> &'static str {
        match self {
            MediaType::Image => "image",
            MediaType::Video => "video",
            MediaType::Document => "document",
        }
    }

    fn max_bytes(self) -> u64 {
        match self {
            MediaType::Image => MAX_IMAGE_BYTES,
            MediaType::Video => MAX_VIDEO_BYTES,
            MediaType::Document => MAX_DOCUMENT_BYTES,
        }
    }
}

pub struct MediaKind {
    pub mime: &'static str,
    pub extension: &'static str,
    aliases: &'static [&'static str],
    pub name: &'static str,
    pub media_type: MediaType,
    matches: fn(&[u8], &str) -> bool,
}

fn ftyp_brand(bytes: &[u8]) -> Option<&[u8]> {
    let brand = bytes.get(8..12)?;
    (bytes.get(4..8)? == b"ftyp" && !AUDIO_BRANDS.contains(&brand)).then_some(brand)
}

fn has_extension(name: &str, extension: &str) -> bool {
    name.rsplit_once('.').is_some_and(|(_, actual)| actual.eq_ignore_ascii_case(extension))
}

fn is_webm(bytes: &[u8]) -> bool {
    bytes.windows(4).any(|window| window == b"webm")
}

const MEDIA_KINDS: [MediaKind; 10] = [
    MediaKind {
        mime: "image/png",
        extension: "png",
        aliases: &[],
        name: "PNG",
        media_type: MediaType::Image,
        matches: |b, _| b.starts_with(b"\x89PNG\r\n\x1a\n"),
    },
    MediaKind {
        mime: "image/jpeg",
        extension: "jpg",
        aliases: &["jpeg"],
        name: "JPEG",
        media_type: MediaType::Image,
        matches: |b, _| b.starts_with(b"\xff\xd8\xff"),
    },
    MediaKind {
        mime: "image/webp",
        extension: "webp",
        aliases: &[],
        name: "WebP",
        media_type: MediaType::Image,
        matches: |b, _| b.starts_with(b"RIFF") && b.get(8..12) == Some(b"WEBP"),
    },
    MediaKind {
        mime: "image/gif",
        extension: "gif",
        aliases: &[],
        name: "GIF",
        media_type: MediaType::Image,
        matches: |b, _| b.starts_with(b"GIF8"),
    },
    MediaKind {
        mime: "video/mp4",
        extension: "mp4",
        aliases: &["m4v"],
        name: "MP4",
        media_type: MediaType::Video,
        matches: |b, _| ftyp_brand(b).is_some_and(|brand| brand != b"qt  "),
    },
    MediaKind {
        mime: "video/webm",
        extension: "webm",
        aliases: &[],
        name: "WebM",
        media_type: MediaType::Video,
        matches: |b, _| b.starts_with(MATROSKA) && is_webm(b),
    },
    MediaKind {
        mime: "video/quicktime",
        extension: "mov",
        aliases: &[],
        name: "MOV",
        media_type: MediaType::Video,
        matches: |b, _| ftyp_brand(b) == Some(b"qt  "),
    },
    MediaKind {
        mime: "video/x-matroska",
        extension: "mkv",
        aliases: &[],
        name: "MKV",
        media_type: MediaType::Video,
        matches: |b, _| b.starts_with(MATROSKA) && !is_webm(b),
    },
    MediaKind {
        mime: "application/pdf",
        extension: "pdf",
        aliases: &[],
        name: "PDF",
        media_type: MediaType::Document,
        matches: |b, _| b.windows(5).any(|window| window == b"%PDF-"),
    },
    MediaKind {
        mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        extension: "docx",
        aliases: &[],
        name: "Word",
        media_type: MediaType::Document,
        matches: |b, name| b.starts_with(ZIP) && has_extension(name, "docx"),
    },
];

impl MediaKind {
    pub fn from_mime(mime: &str) -> Option<&'static MediaKind> {
        MEDIA_KINDS.iter().find(|kind| kind.mime == mime)
    }

    pub fn sniff(bytes: &[u8], name: &str) -> Option<&'static MediaKind> {
        MEDIA_KINDS.iter().find(|kind| (kind.matches)(bytes, name))
    }

    pub fn fits(&self, len: u64) -> bool {
        len <= self.media_type.max_bytes()
    }

    pub fn label(&self) -> String {
        format!("{} {}", self.name, self.media_type.noun())
    }

    pub fn file_name(&self, stem: &str) -> String {
        format!("{stem}.{}", self.extension)
    }

    fn extensions(&self) -> impl Iterator<Item = &'static str> {
        std::iter::once(self.extension).chain(self.aliases.iter().copied())
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaFormat {
    pub mime: &'static str,
    pub label: String,
    pub extensions: Vec<&'static str>,
    pub media_type: MediaType,
}

pub fn media_formats() -> Vec<MediaFormat> {
    MEDIA_KINDS
        .iter()
        .map(|kind| MediaFormat {
            mime: kind.mime,
            label: kind.label(),
            extensions: kind.extensions().collect(),
            media_type: kind.media_type,
        })
        .collect()
}

pub fn is_media_extension(extension: &str) -> bool {
    let extension = extension.to_ascii_lowercase();
    MEDIA_KINDS.iter().flat_map(MediaKind::extensions).any(|known| known == extension)
}

pub fn is_supported_image(bytes: &[u8]) -> bool {
    MediaKind::sniff(bytes, "").is_some_and(|kind| kind.media_type == MediaType::Image && kind.fits(bytes.len() as u64))
}

fn join_or(names: &[&str]) -> String {
    match names {
        [] => String::new(),
        [only] => (*only).to_string(),
        [rest @ .., last] => format!("{} or {last}", rest.join(", ")),
    }
}

fn supported(media_type: MediaType) -> String {
    let names: Vec<&str> =
        MEDIA_KINDS.iter().filter(|kind| kind.media_type == media_type).map(|kind| kind.name).collect();
    format!("{} {} under {} MB", join_or(&names), media_type.noun(), media_type.max_bytes() / MB)
}

pub fn unsupported_image() -> Error {
    Error::Message(format!("Couldn't use this image. Try a {}.", supported(MediaType::Image)))
}

pub fn unsupported_media() -> Error {
    let [image, video, document] = [MediaType::Image, MediaType::Video, MediaType::Document].map(supported);
    Error::Message(format!("Couldn't use this file. Try a {image}, a {video}, or a {document}."))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sniffed(bytes: &[u8]) -> Option<&'static str> {
        MediaKind::sniff(bytes, "").map(|kind| kind.mime)
    }

    #[test]
    fn recognizes_images_and_videos() {
        assert_eq!(sniffed(b"\x89PNG\r\n\x1a\n...."), Some("image/png"));
        assert_eq!(sniffed(b"\xff\xd8\xff\xe0...."), Some("image/jpeg"));
        assert_eq!(sniffed(b"GIF89a...."), Some("image/gif"));
        assert_eq!(sniffed(b"RIFF\0\0\0\0WEBPVP8 "), Some("image/webp"));
        assert_eq!(sniffed(b"RIFF\0\0\0\0WAVEfmt "), None);
        assert_eq!(sniffed(b"\0\0\0\x20ftypisom\0\0\0\0"), Some("video/mp4"));
        assert_eq!(sniffed(b"\0\0\0\x14ftypqt  \0\0\0\0"), Some("video/quicktime"));
        assert_eq!(sniffed(b"\x1a\x45\xdf\xa3\x9f\x42\x82\x84webm"), Some("video/webm"));
        assert_eq!(sniffed(b"\x1a\x45\xdf\xa3\x9f\x42\x82\x88matroska"), Some("video/x-matroska"));
        assert_eq!(sniffed(b"\0\0\0\x20ftypM4A \0\0\0\0"), None);
        assert_eq!(sniffed(b"<svg xmlns="), None);
        assert_eq!(sniffed(b""), None);
    }

    #[test]
    fn recognizes_pdf_and_word_documents() {
        assert_eq!(sniffed(b"%PDF-1.7\n%...."), Some("application/pdf"));
        assert_eq!(sniffed(b"\xef\xbb\xbf%PDF-1.4"), Some("application/pdf"));
        let docx = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        let zip = b"PK\x03\x04\x14\0\x06\0";
        assert_eq!(MediaKind::sniff(zip, "Report.DOCX").map(|kind| kind.mime), Some(docx));
        assert_eq!(MediaKind::sniff(zip, "Sheet.xlsx").map(|kind| kind.mime), None);
        assert_eq!(MediaKind::sniff(zip, "").map(|kind| kind.mime), None);
        assert_eq!(MediaKind::sniff(b"plain text", "notes.docx").map(|kind| kind.mime), None);
    }

    #[test]
    fn videos_get_a_larger_size_limit() {
        let mp4 = MediaKind::from_mime("video/mp4").unwrap();
        let png = MediaKind::from_mime("image/png").unwrap();
        assert!(mp4.fits(MAX_VIDEO_BYTES) && !mp4.fits(MAX_VIDEO_BYTES + 1));
        assert!(!png.fits(MAX_IMAGE_BYTES + 1));
        let mut huge = b"GIF89a".to_vec();
        huge.resize(MAX_IMAGE_BYTES as usize + 1, 0);
        assert!(!is_supported_image(&huge) && is_supported_image(b"GIF89a"));
        assert!(!is_supported_image(b"\0\0\0\x20ftypisom\0\0\0\0"));
    }

    #[test]
    fn names_and_messages_come_from_the_table() {
        let png = MediaKind::from_mime("image/png").unwrap();
        assert_eq!((png.label(), png.file_name("Photo")), ("PNG image".into(), "Photo.png".into()));
        assert_eq!(supported(MediaType::Image), "PNG, JPEG, WebP or GIF image under 25 MB");
        assert_eq!(supported(MediaType::Video), "MP4, WebM, MOV or MKV video under 512 MB");
        assert_eq!(supported(MediaType::Document), "PDF or Word document under 100 MB");
        assert!(is_media_extension("JPEG") && is_media_extension("mov") && !is_media_extension("txt"));
        assert!(is_media_extension("pdf") && is_media_extension("DOCX") && !is_media_extension("doc"));
    }
}
