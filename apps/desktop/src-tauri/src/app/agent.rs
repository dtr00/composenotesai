use crate::features::notes::{EntryRef, NoteFormat, NoteStore, MAX_NOTE_BYTES, MAX_NOTE_MB};
use crate::shared::{
    db,
    error::{Error, Result},
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::io::{self, Read, Write};
use std::path::Path;

#[derive(Deserialize)]
#[serde(tag = "op", rename_all = "snake_case", deny_unknown_fields)]
enum Request {
    List,
    Create {
        #[serde(default)]
        format: NoteFormat,
        title: Option<String>,
        #[serde(rename = "parentId")]
        parent_id: Option<i64>,
    },
    Load {
        id: i64,
    },
    Save {
        id: i64,
        scene: Value,
    },
    Duplicate {
        id: i64,
    },
    Rename {
        id: i64,
        title: String,
    },
}

fn execute(notes: &NoteStore, request: Request) -> Result<Value> {
    Ok(match request {
        Request::List => json!(notes.list()?),
        Request::Create { format, title, parent_id } => json!(notes.create_as(parent_id, title.as_deref(), format)?),
        Request::Load { id } => {
            let note = notes.load(id)?;
            let scene = if note.format == NoteFormat::Excalidraw {
                Some(serde_json::from_str::<Value>(&note.body)?)
            } else {
                None
            };
            let mut result = json!(note);
            if let Some(scene) = scene {
                result["scene"] = scene;
            }
            result
        }
        Request::Save { id, scene } => {
            if notes.format(id)? != NoteFormat::Excalidraw {
                return Err(Error::Message("This note is not an Excalidraw drawing.".into()));
            }
            notes.save(id, &scene.to_string())?;
            json!({"id": id})
        }
        Request::Duplicate { id } => json!(notes.duplicate_entry(EntryRef::Note(id))?),
        Request::Rename { id, title } => json!({"title": notes.rename(id, &title)?}),
    })
}

fn request(data_dir: &Path) -> Result<Value> {
    let mut input = String::new();
    io::stdin().take(MAX_NOTE_BYTES + 1).read_to_string(&mut input)?;
    if input.len() as u64 > MAX_NOTE_BYTES {
        return Err(Error::Message(format!("The agent request exceeds {MAX_NOTE_MB} MB.")));
    }
    let request = serde_json::from_str(&input)?;
    std::fs::create_dir_all(data_dir)?;
    let notes = NoteStore::new(db::open(&data_dir.join(db::DATABASE_FILE), super::MIGRATIONS)?)?;
    execute(&notes, request)
}

pub(super) fn run() -> i32 {
    let args: Vec<_> = std::env::args_os().skip(1).collect();
    let result = match args.as_slice() {
        [agent, flag, dir] if agent == "--agent" && flag == "--data-dir" => request(Path::new(dir)),
        _ => Err(Error::Message(
            "Usage: composenotesai --agent --data-dir <app data folder>; send one JSON request on stdin.".into(),
        )),
    };
    let code = i32::from(result.is_err());
    let response = match result {
        Ok(value) => json!({"ok": true, "result": value}),
        Err(error) => json!({"ok": false, "error": error.to_string()}),
    };
    if writeln!(io::stdout(), "{response}").is_err() {
        return 1;
    }
    code
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::shared::db::open_in_memory;

    #[test]
    fn agents_create_edit_read_and_duplicate_drawings_without_the_plugin() {
        let notes = NoteStore::new(open_in_memory(super::super::MIGRATIONS).unwrap()).unwrap();
        let request = |value| serde_json::from_value(value).unwrap();
        let created = execute(&notes, request(json!({"op":"create", "format":"excalidraw"}))).unwrap();
        let id = created["id"].as_i64().unwrap();
        let scene = json!({"type":"excalidraw", "version":2, "elements":[]});
        execute(&notes, request(json!({"op":"save", "id":id, "scene":scene}))).unwrap();
        let loaded = execute(&notes, request(json!({"op":"load", "id":id}))).unwrap();
        assert_eq!(loaded["scene"], scene);
        assert_eq!(loaded["format"], "excalidraw");
        let copy = execute(&notes, request(json!({"op":"duplicate", "id":id}))).unwrap();
        assert_ne!(copy["id"], id);
        assert_eq!(execute(&notes, Request::List).unwrap().as_array().unwrap().len(), 2);
    }
}
