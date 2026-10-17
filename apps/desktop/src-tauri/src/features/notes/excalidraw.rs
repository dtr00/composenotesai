use crate::shared::error::{Error, Result};
use serde_json::{json, Value};
use std::collections::HashSet;

const ELEMENT_TYPES: &[&str] = &[
    "rectangle",
    "diamond",
    "ellipse",
    "text",
    "line",
    "arrow",
    "freedraw",
    "image",
    "frame",
    "magicframe",
    "embeddable",
    "iframe",
    "video",
    "generic",
    "document",
];

pub(super) fn searchable_text(body: &str) -> Result<String> {
    let scene: Value = serde_json::from_str(body)?;
    let elements = scene["elements"].as_array().ok_or_else(invalid)?;
    Ok(elements
        .iter()
        .filter(|element| element["isDeleted"] != true)
        .flat_map(|element| [element["text"].as_str(), element["link"].as_str()])
        .flatten()
        .collect::<Vec<_>>()
        .join("\n"))
}

fn invalid() -> Error {
    Error::Message("Invalid Excalidraw scene. Use version 2 JSON with an elements array.".into())
}

pub(super) fn validate_scene(body: &str) -> Result<()> {
    let scene: Value = serde_json::from_str(body).map_err(|_| invalid())?;
    if scene["type"] != "excalidraw" || scene["version"] != 2 {
        return Err(invalid());
    }
    let elements = scene["elements"].as_array().ok_or_else(invalid)?;
    let mut ids = HashSet::new();
    for element in elements {
        let id = element["id"].as_str().filter(|id| !id.is_empty()).ok_or_else(invalid)?;
        let kind = element["type"].as_str().ok_or_else(invalid)?;
        if !ids.insert(id) || !ELEMENT_TYPES.contains(&kind) {
            return Err(invalid());
        }
        for field in ["x", "y", "width", "height"] {
            let value = element[field].as_f64().ok_or_else(invalid)?;
            if !value.is_finite() || (matches!(field, "width" | "height") && value < 0.0) {
                return Err(invalid());
            }
        }
    }
    for field in ["appState", "files"] {
        if scene.get(field).is_some_and(|value| !value.is_object()) {
            return Err(invalid());
        }
    }
    Ok(())
}

pub(super) fn empty_scene() -> String {
    json!({
        "type": "excalidraw", "version": 2, "source": "Compose Notes AI",
        "elements": [], "appState": {}, "files": {},
    })
    .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::features::notes::model::UNTITLED_DRAWING;
    use crate::features::notes::{Entry, EntryRef, NoteFormat, NoteStore};

    #[test]
    fn drawings_use_numbered_titles_and_keep_format_when_copied_and_restored() {
        let store = NoteStore::open_in_memory().unwrap();
        let folder = store.create_folder(None).unwrap().id;
        let first = store.create_as(Some(folder), None, NoteFormat::Excalidraw).unwrap();
        let second = store.create_as(None, None, NoteFormat::Excalidraw).unwrap();
        assert_eq!((first.title.as_str(), second.title.as_str()), (UNTITLED_DRAWING, "Untitled excalidraw note 1"));
        let body = json!({"type":"excalidraw", "version":2, "elements":[
            {"id":"box", "type":"rectangle", "x":10, "y":20, "width":100, "height":50, "customData":{"agent":true}}
        ]})
        .to_string();
        store.save(first.id, &body).unwrap();
        let EntryRef::Note(copy) = store.duplicate_entry(EntryRef::Note(first.id)).unwrap() else { panic!("note") };
        let trash = store.trash_entries(&[EntryRef::Note(copy)]).unwrap();
        store.restore_trash(&trash.trash_ids).unwrap();
        let saved = store.load(copy).unwrap();
        assert_eq!(saved.format, NoteFormat::Excalidraw);
        assert_eq!(saved.body, body);
        assert_eq!(saved.parent_id, Some(folder));
        assert_eq!(saved.title, "Untitled excalidraw note copy");
        assert!(store.list().unwrap().iter().any(|entry| matches!(entry,
            Entry::Note(note) if note.id == copy && note.format == NoteFormat::Excalidraw)));
    }

    #[test]
    fn malformed_scenes_never_replace_saved_drawings() {
        let store = NoteStore::open_in_memory().unwrap();
        let note = store.create_as(None, None, NoteFormat::Excalidraw).unwrap();
        let original = store.load(note.id).unwrap().body;
        for body in ["Markdown", "{}", r#"{"type":"excalidraw","version":2,"elements":[{"id":"a"}]}"#] {
            assert!(store.save(note.id, body).is_err());
            assert_eq!(store.load(note.id).unwrap().body, original);
        }
    }

    #[test]
    fn drawing_titles_reuse_gaps_and_check_all_note_titles() {
        let store = NoteStore::open_in_memory().unwrap();
        store.create(None, Some("UNTITLED EXCALIDRAW NOTE")).unwrap();
        let first = store.create_as(None, None, NoteFormat::Excalidraw).unwrap();
        store.create_as(None, None, NoteFormat::Excalidraw).unwrap();
        store.rename(first.id, "Diagram").unwrap();
        assert_eq!(store.create_as(None, None, NoteFormat::Excalidraw).unwrap().title, "Untitled excalidraw note 1");
    }
}
