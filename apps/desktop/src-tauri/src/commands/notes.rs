use crate::features::notes::{
    Entry, EntryRef, Folder, Note, NoteFormat, NoteStore, NoteSummary, SearchHit, TrashItem, Trashed,
};
use crate::shared::error::Result;
use tauri::State;

#[tauri::command]
pub fn create_note(
    notes: State<NoteStore>,
    parent_id: Option<i64>,
    title: Option<String>,
    format: Option<NoteFormat>,
) -> Result<NoteSummary> {
    notes.create_as(parent_id, title.as_deref(), format.unwrap_or_default())
}

#[tauri::command]
pub fn create_folder(notes: State<NoteStore>, parent_id: Option<i64>) -> Result<Folder> {
    notes.create_folder(parent_id)
}

#[tauri::command]
pub fn list_entries(notes: State<NoteStore>) -> Result<Vec<Entry>> {
    notes.list()
}

#[tauri::command]
pub fn load_note(notes: State<NoteStore>, id: i64) -> Result<Note> {
    notes.load(id)
}

const MAX_SEARCH_RESULTS: usize = 25;

#[tauri::command]
pub async fn search_notes(notes: State<'_, NoteStore>, query: String, limit: usize) -> Result<Vec<SearchHit>> {
    notes.search(&query, limit.clamp(1, MAX_SEARCH_RESULTS))
}

#[tauri::command]
pub fn save_note(notes: State<NoteStore>, id: i64, body: String) -> Result<()> {
    notes.save(id, &body)
}

#[tauri::command]
pub fn rename_note(notes: State<NoteStore>, id: i64, title: String) -> Result<Option<String>> {
    notes.rename(id, &title)
}

#[tauri::command]
pub fn duplicate_entry(notes: State<NoteStore>, entry: EntryRef) -> Result<EntryRef> {
    notes.duplicate_entry(entry)
}

#[tauri::command]
pub fn rename_folder(notes: State<NoteStore>, id: i64, name: String) -> Result<Option<String>> {
    notes.rename_folder(id, &name)
}

#[tauri::command]
pub fn set_folder_collapsed(notes: State<NoteStore>, id: i64, collapsed: bool) -> Result<()> {
    notes.set_folder_collapsed(id, collapsed)
}

#[tauri::command]
pub fn move_entries(
    notes: State<NoteStore>,
    entries: Vec<EntryRef>,
    parent_id: Option<i64>,
    index: usize,
) -> Result<()> {
    notes.move_entries(&entries, parent_id, index)
}

#[tauri::command]
pub fn set_all_folders_collapsed(notes: State<NoteStore>, collapsed: bool) -> Result<()> {
    notes.set_all_folders_collapsed(collapsed)
}

#[tauri::command]
pub fn trash_entries(notes: State<NoteStore>, entries: Vec<EntryRef>) -> Result<Trashed> {
    notes.trash_entries(&entries)
}

#[tauri::command]
pub fn restore_trash(notes: State<NoteStore>, ids: Vec<i64>) -> Result<Vec<EntryRef>> {
    notes.restore_trash(&ids)
}

#[tauri::command]
pub fn list_trash(notes: State<NoteStore>) -> Result<Vec<TrashItem>> {
    notes.list_trash()
}

#[tauri::command]
pub fn delete_from_trash(notes: State<NoteStore>, ids: Vec<i64>) -> Result<()> {
    notes.delete_from_trash(&ids)
}

#[tauri::command]
pub fn empty_trash(notes: State<NoteStore>) -> Result<()> {
    notes.empty_trash()
}
