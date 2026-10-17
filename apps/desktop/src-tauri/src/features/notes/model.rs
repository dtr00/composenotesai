use crate::entities::media::{MediaKind, MediaType};
use crate::shared::error::Error;
use rusqlite::types::{FromSql, FromSqlError, FromSqlResult, ValueRef};
use serde::{Deserialize, Serialize};

#[derive(Debug, Default, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NotesUsage {
    pub notes: u64,
    pub folders: u64,
    pub text_bytes: u64,
    pub note_bytes: u64,
    pub folder_bytes: u64,
    pub media: u64,
    pub media_bytes: u64,
    pub trash_bytes: u64,
}

#[derive(Debug, Default, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Trashed {
    pub trash_ids: Vec<i64>,
    pub removed: Vec<EntryRef>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum EntryType {
    Note,
    Folder,
    Image,
    Video,
    Document,
}

impl From<MediaType> for EntryType {
    fn from(media_type: MediaType) -> Self {
        match media_type {
            MediaType::Image => EntryType::Image,
            MediaType::Video => EntryType::Video,
            MediaType::Document => EntryType::Document,
        }
    }
}

#[derive(Debug, Default, PartialEq, Serialize)]
pub struct EntryCounts {
    pub note: u64,
    pub image: u64,
    pub video: u64,
    pub document: u64,
}

impl EntryCounts {
    pub(super) fn add_media(&mut self, media_type: MediaType, count: u64) {
        match media_type {
            MediaType::Image => self.image += count,
            MediaType::Video => self.video += count,
            MediaType::Document => self.document += count,
        }
    }
}

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrashItem {
    pub id: i64,
    pub entry: EntryRef,
    pub entry_type: EntryType,
    pub name: String,
    pub deleted_at: i64,
    pub counts: EntryCounts,
    pub bytes: u64,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum NoteFormat {
    #[default]
    Markdown,
    Excalidraw,
}

impl NoteFormat {
    pub(super) fn as_str(self) -> &'static str {
        match self {
            Self::Markdown => "markdown",
            Self::Excalidraw => "excalidraw",
        }
    }

    pub(super) fn untitled(self) -> &'static str {
        match self {
            Self::Markdown => UNTITLED,
            Self::Excalidraw => UNTITLED_DRAWING,
        }
    }

    pub(super) fn empty_body(self) -> String {
        match self {
            Self::Markdown => String::new(),
            Self::Excalidraw => super::excalidraw::empty_scene(),
        }
    }
}

impl FromSql for NoteFormat {
    fn column_result(value: ValueRef<'_>) -> FromSqlResult<Self> {
        match value.as_str()? {
            "markdown" => Ok(Self::Markdown),
            "excalidraw" => Ok(Self::Excalidraw),
            _ => Err(FromSqlError::Other("unknown note format".into())),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteSummary {
    pub format: NoteFormat,
    pub id: i64,
    pub title: String,
    pub parent_id: Option<i64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Folder {
    pub id: i64,
    pub name: String,
    pub parent_id: Option<i64>,
    pub collapsed: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaSummary {
    pub id: i64,
    pub name: String,
    pub parent_id: Option<i64>,
    pub media_type: MediaType,
    pub mime: &'static str,
    pub bytes: u64,
}

impl MediaSummary {
    pub(super) fn new(id: i64, name: String, parent_id: Option<i64>, kind: &MediaKind, bytes: u64) -> Self {
        MediaSummary { id, name, parent_id, media_type: kind.media_type, mime: kind.mime, bytes }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaLink {
    pub media_id: i64,
    pub note: NoteSummary,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaInfo {
    pub created_at: i64,
    pub notes: Vec<NoteSummary>,
}

#[derive(Debug, Serialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum Entry {
    Note(NoteSummary),
    Folder(Folder),
    Media(MediaSummary),
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", content = "id", rename_all = "lowercase")]
pub enum EntryRef {
    Note(i64),
    Folder(i64),
    Media(i64),
}

impl FromSql for &'static MediaKind {
    fn column_result(value: ValueRef<'_>) -> FromSqlResult<Self> {
        let mime = value.as_str()?;
        MediaKind::from_mime(mime).ok_or_else(|| FromSqlError::Other(format!("unknown media type {mime}").into()))
    }
}

pub(super) const NOTE_KIND: i64 = 0;
pub(super) const FOLDER_KIND: i64 = 1;
pub(super) const MEDIA_KIND: i64 = 2;

impl EntryRef {
    pub(super) fn from_row(kind: i64, id: i64) -> rusqlite::Result<Self> {
        match kind {
            NOTE_KIND => Ok(EntryRef::Note(id)),
            FOLDER_KIND => Ok(EntryRef::Folder(id)),
            MEDIA_KIND => Ok(EntryRef::Media(id)),
            _ => Err(rusqlite::Error::IntegralValueOutOfRange(0, kind)),
        }
    }

    pub(super) fn kind(self) -> i64 {
        match self {
            EntryRef::Note(_) => NOTE_KIND,
            EntryRef::Folder(_) => FOLDER_KIND,
            EntryRef::Media(_) => MEDIA_KIND,
        }
    }

    pub(super) fn id(self) -> i64 {
        match self {
            EntryRef::Note(id) | EntryRef::Folder(id) | EntryRef::Media(id) => id,
        }
    }

    pub(super) fn is_folder(self) -> bool {
        matches!(self, EntryRef::Folder(_))
    }

    pub(super) fn table(self) -> &'static str {
        match self {
            EntryRef::Note(_) => "notes",
            EntryRef::Folder(_) => "folders",
            EntryRef::Media(_) => "media",
        }
    }

    pub(super) fn live_table(self) -> &'static str {
        match self {
            EntryRef::Note(_) => "live_notes",
            EntryRef::Folder(_) => "live_folders",
            EntryRef::Media(_) => "live_media",
        }
    }

    pub(super) fn parent_column(self) -> &'static str {
        if self.is_folder() {
            "parent_id"
        } else {
            "folder_id"
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    pub format: NoteFormat,
    pub id: i64,
    pub title: String,
    pub parent_id: Option<i64>,
    pub body: String,
}

pub const UNTITLED: &str = "Untitled note";
pub const UNTITLED_DRAWING: &str = "Untitled excalidraw note";
pub const UNTITLED_FOLDER: &str = "Untitled folder";
pub const NOTE: &str = "Note";
pub const FOLDER: &str = "Folder";
pub const MEDIA: &str = "File";

pub fn corrupt_note(id: i64, error: &std::io::Error) -> Error {
    Error::Message(format!("Note {id} couldn't be decoded: {error}"))
}

pub fn title_key(title: &str) -> String {
    title.trim().to_lowercase()
}

pub fn copy_title(title: &str) -> String {
    format!("{title} copy")
}

pub fn first_free_name<'a>(stem: &str, suffix: &str, taken: impl IntoIterator<Item = &'a str>) -> String {
    let taken: Vec<String> = taken.into_iter().map(title_key).collect();
    let candidate = |n: usize| if n == 0 { format!("{stem}{suffix}") } else { format!("{stem} {n}{suffix}") };
    (0..).map(candidate).find(|name| !taken.contains(&title_key(name))).unwrap()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn first_untitled_has_no_number() {
        assert_eq!(first_free_name(UNTITLED, "", []), "Untitled note");
    }

    #[test]
    fn next_untitled_counts_up() {
        assert_eq!(first_free_name(UNTITLED, "", ["Untitled note", "Untitled note 1"]), "Untitled note 2");
    }

    #[test]
    fn untitled_reuses_earliest_gap() {
        assert_eq!(first_free_name(UNTITLED, "", ["Untitled note", "Untitled note 2"]), "Untitled note 1");
    }

    #[test]
    fn copy_title_counts_up_when_taken() {
        assert_eq!(first_free_name(&copy_title("Groceries"), "", ["groceries COPY"]), "Groceries copy 1");
    }

    #[test]
    fn untitled_ignores_case_and_spacing() {
        assert_eq!(first_free_name(UNTITLED, "", ["  untitled NOTE "]), "Untitled note 1");
    }
}
