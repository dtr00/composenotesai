use super::io::NoteStore;
use super::model::{corrupt_note, NoteFormat};
use crate::shared::error::Result;
use crate::shared::text::collapse_whitespace;
use serde::Serialize;

const MIN_TERM_CHARS: usize = 2;
const TITLE_SCORE: usize = 5;
const MAX_BODY_SCORE: usize = 5;
const SNIPPET_CONTEXT_CHARS: usize = 80;

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SearchHit {
    pub id: i64,
    pub title: String,
    pub parent_id: Option<i64>,
    pub snippet: String,
    pub format: NoteFormat,
}

type StoredNote = (i64, String, Option<i64>, Vec<u8>, u32, NoteFormat);

struct Ranked {
    hit: SearchHit,
    matched: usize,
    score: usize,
}

fn terms(query: &str) -> Vec<String> {
    let mut terms: Vec<String> = query
        .split(|c: char| !c.is_alphanumeric())
        .filter(|term| term.chars().count() >= MIN_TERM_CHARS)
        .map(str::to_lowercase)
        .collect();
    terms.sort();
    terms.dedup();
    terms
}

fn floor_boundary(text: &str, mut index: usize) -> usize {
    while !text.is_char_boundary(index) {
        index -= 1;
    }
    index
}

fn snippet(body: &str, lower: &str, terms: &[String]) -> String {
    let found = terms.iter().filter_map(|term| lower.find(term.as_str())).min();
    let Some(at) = found.filter(|_| lower.len() == body.len()) else {
        return collapse_whitespace(&body.chars().take(SNIPPET_CONTEXT_CHARS * 2).collect::<String>());
    };
    let start = floor_boundary(body, at.saturating_sub(SNIPPET_CONTEXT_CHARS));
    let end = floor_boundary(body, (at + SNIPPET_CONTEXT_CHARS).min(body.len()));
    let text = collapse_whitespace(&body[start..end]);
    let prefix = if start > 0 { "…" } else { "" };
    let suffix = if end < body.len() { "…" } else { "" };
    format!("{prefix}{text}{suffix}")
}

fn rank(
    id: i64,
    title: String,
    parent_id: Option<i64>,
    body: &str,
    format: NoteFormat,
    terms: &[String],
) -> Option<Ranked> {
    let lower_title = title.to_lowercase();
    let lower_body = body.to_lowercase();
    let mut matched = 0;
    let mut score = 0;
    for term in terms {
        let in_title = lower_title.contains(term.as_str());
        let in_body = lower_body.matches(term.as_str()).take(MAX_BODY_SCORE).count();
        if in_title || in_body > 0 {
            matched += 1;
        }
        score += if in_title { TITLE_SCORE } else { 0 } + in_body;
    }
    (matched > 0).then(|| Ranked {
        hit: SearchHit { id, title, parent_id, snippet: snippet(body, &lower_body, terms), format },
        matched,
        score,
    })
}

impl NoteStore {
    pub fn search(&self, query: &str, limit: usize) -> Result<Vec<SearchHit>> {
        let terms = terms(query);
        if terms.is_empty() {
            return Ok(Vec::new());
        }
        let mut store = self.db.lock();
        let rows: Vec<StoredNote> = {
            let mut stmt = store.conn.prepare("SELECT id, title, folder_id, body, dict_id, format FROM live_notes")?;
            let rows =
                stmt.query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?, r.get(5)?)))?;
            rows.collect::<rusqlite::Result<_>>()?
        };
        let mut ranked = Vec::new();
        for (id, title, parent_id, body, dict_id, format) in rows {
            let body = store.codec.decompress(dict_id, &body).map_err(|e| corrupt_note(id, &e))?;
            let body = if format == NoteFormat::Excalidraw { super::excalidraw::searchable_text(&body)? } else { body };
            ranked.extend(rank(id, title, parent_id, &body, format, &terms));
        }
        ranked.sort_by(|a, b| b.matched.cmp(&a.matched).then(b.score.cmp(&a.score)).then(a.hit.id.cmp(&b.hit.id)));
        Ok(ranked.into_iter().take(limit).map(|ranked| ranked.hit).collect())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn note(store: &NoteStore, title: &str, body: &str) -> i64 {
        let note = store.create(None, Some(title)).unwrap();
        store.save(note.id, body).unwrap();
        note.id
    }

    #[test]
    fn searches_visible_drawing_labels_without_matching_scene_metadata_or_embedded_files() {
        let store = NoteStore::open_in_memory().unwrap();
        let drawing = store.create_as(None, Some("Architecture"), NoteFormat::Excalidraw).unwrap();
        let body = serde_json::json!({
            "type":"excalidraw", "version":2, "elements":[
                {"id":"label", "type":"text", "x":0, "y":0, "width":100, "height":30, "text":"Payment gateway"},
                {"id":"deleted", "type":"text", "x":0, "y":0, "width":100, "height":30, "text":"Removed secret", "isDeleted":true},
                {"id":"picture", "type":"image", "x":0, "y":0, "width":100, "height":100, "fileId":"file"}
            ], "files":{"file":{"mimeType":"image/png", "dataURL":"data:image/png;base64,EmbeddedSecret"}}
        }).to_string();
        store.save(drawing.id, &body).unwrap();
        let hits = store.search("payment", 8).unwrap();
        assert_eq!(hits[0].id, drawing.id);
        assert_eq!(hits[0].format, NoteFormat::Excalidraw);
        assert_eq!(hits[0].snippet, "Payment gateway");
        for query in ["Removed secret", "EmbeddedSecret", "dataURL", "fileId"] {
            assert!(store.search(query, 8).unwrap().is_empty(), "{query}");
        }
        assert_eq!(store.search("Architecture", 8).unwrap()[0].id, drawing.id);
    }

    #[test]
    fn finds_notes_by_title_and_body_and_ranks_more_matches_first() {
        let store = NoteStore::open_in_memory().unwrap();
        let groceries = note(&store, "Groceries", "eggs, milk and bread");
        let recipe = note(&store, "Pancakes", "Mix the milk with eggs and flour.");
        note(&store, "Travel", "Book the train to Lyon.");
        let hits = store.search("milk pancakes", 10).unwrap();
        assert_eq!(hits.iter().map(|hit| hit.id).collect::<Vec<_>>(), [recipe, groceries]);
        assert!(hits[0].snippet.contains("milk"));
    }

    #[test]
    fn ignores_short_terms_and_empty_queries() {
        let store = NoteStore::open_in_memory().unwrap();
        note(&store, "A", "a b c");
        assert!(store.search("", 10).unwrap().is_empty());
        assert!(store.search("a b", 10).unwrap().is_empty());
    }

    #[test]
    fn respects_the_limit() {
        let store = NoteStore::open_in_memory().unwrap();
        for index in 0..5 {
            note(&store, &format!("Idea {index}"), "shared word");
        }
        assert_eq!(store.search("shared", 3).unwrap().len(), 3);
    }

    #[test]
    fn snippets_stay_on_character_boundaries() {
        let body = format!("{}needle{}", "é".repeat(100), "ü".repeat(100));
        let lower = body.to_lowercase();
        let text = snippet(&body, &lower, &["needle".into()]);
        assert!(text.contains("needle"));
        assert!(text.starts_with('…') && text.ends_with('…'));
    }
}
