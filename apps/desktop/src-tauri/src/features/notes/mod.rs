mod compression;
mod excalidraw;
mod io;
mod media;
mod media_links;
mod media_names;
mod model;
mod schema;
mod search;
mod trash;
mod usage;

pub use compression::{MAX_NOTE_BYTES, MAX_NOTE_MB};
pub use io::NoteStore;
pub use media::NoteMedia;
pub use model::{
    Entry, EntryRef, Folder, MediaInfo, MediaLink, MediaSummary, Note, NoteFormat, NoteSummary, NotesUsage, TrashItem,
    Trashed,
};
pub use schema::{ADD_FOLDERS, ADD_LIVE_VIEWS, ADD_MEDIA, ADD_NOTE_FORMAT, ADD_TRASH, CREATE_NOTES_TABLE};
pub use search::SearchHit;
