use super::parse::{parse_skill, slug, validate, ParsedSkill};
use crate::shared::db::now_ms;
use crate::shared::error::{Error, Result};
use crate::shared::lock::Lock;
use rusqlite::{params, Connection, OptionalExtension, Row};
use serde::Serialize;

pub const CREATE_SKILLS_TABLE: &str = "
CREATE TABLE IF NOT EXISTS skills (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    body TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    source TEXT,
    updated_at INTEGER NOT NULL
);";

const SUMMARY_COLUMNS: &str =
    "id, name, description, enabled, source, length(CAST(name AS BLOB)) + length(CAST(description AS BLOB)) + length(CAST(body AS BLOB))";

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SkillSummary {
    pub id: i64,
    pub name: String,
    pub description: String,
    pub enabled: bool,
    pub source: Option<String>,
    pub bytes: u64,
}

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Skill {
    #[serde(flatten)]
    pub summary: SkillSummary,
    pub body: String,
}

pub struct SkillStore {
    conn: Lock<Connection>,
}

fn summary(row: &Row) -> rusqlite::Result<SkillSummary> {
    Ok(SkillSummary {
        id: row.get(0)?,
        name: row.get(1)?,
        description: row.get(2)?,
        enabled: row.get(3)?,
        source: row.get(4)?,
        bytes: row.get::<_, i64>(5)?.unsigned_abs(),
    })
}

const SKILL: &str = "Skill";

fn taken(name: &str) -> Error {
    Error::Message(format!("There's already a skill called “{name}”."))
}

impl SkillStore {
    pub fn new(conn: Connection) -> Self {
        Self { conn: Lock::new(conn) }
    }

    #[cfg(test)]
    fn open_in_memory() -> Result<Self> {
        let migrations = [crate::shared::db::Migration::Sql(CREATE_SKILLS_TABLE)];
        Ok(Self::new(crate::shared::db::open_in_memory(&migrations)?))
    }

    pub fn list(&self) -> Result<Vec<SkillSummary>> {
        let conn = self.conn.lock();
        let mut stmt = conn.prepare(&format!("SELECT {SUMMARY_COLUMNS} FROM skills ORDER BY name"))?;
        let rows = stmt.query_map([], summary)?;
        Ok(rows.collect::<rusqlite::Result<_>>()?)
    }

    fn load_where(&self, filter: &str, value: impl rusqlite::ToSql) -> Result<Option<Skill>> {
        let conn = self.conn.lock();
        let sql = format!("SELECT {SUMMARY_COLUMNS}, body FROM skills WHERE {filter}");
        Ok(conn.query_row(&sql, [value], |row| Ok(Skill { summary: summary(row)?, body: row.get(6)? })).optional()?)
    }

    pub fn load(&self, id: i64) -> Result<Skill> {
        self.load_where("id = ?1", id)?.ok_or(Error::NotFound(SKILL, id))
    }

    pub fn find_enabled(&self, name: &str) -> Result<Option<Skill>> {
        self.load_where("enabled AND name = ?1", slug(name))
    }

    pub fn install(&self, text: &str, source: Option<&str>, fallback_name: Option<&str>) -> Result<SkillSummary> {
        let ParsedSkill { name, description, body } = parse_skill(text, fallback_name)?;
        let conn = self.conn.lock();
        let inserted = conn.execute(
            "INSERT INTO skills (name, description, body, source, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT (name) DO NOTHING",
            params![name, description, body, source, now_ms()],
        )?;
        if inserted == 0 {
            return Err(taken(&name));
        }
        let id = conn.last_insert_rowid();
        drop(conn);
        Ok(self.load(id)?.summary)
    }

    pub fn save(&self, id: Option<i64>, name: &str, description: &str, body: &str) -> Result<SkillSummary> {
        let ParsedSkill { name, description, body } = validate(name, description, body)?;
        let conn = self.conn.lock();
        let owner: Option<i64> =
            conn.query_row("SELECT id FROM skills WHERE name = ?1", [&name], |r| r.get(0)).optional()?;
        if owner.is_some() && owner != id {
            return Err(taken(&name));
        }
        let saved = match id {
            Some(id) => {
                let changed = conn.execute(
                    "UPDATE skills SET name = ?1, description = ?2, body = ?3, updated_at = ?4 WHERE id = ?5",
                    params![name, description, body, now_ms(), id],
                )?;
                if changed == 0 {
                    return Err(Error::NotFound(SKILL, id));
                }
                id
            }
            None => {
                conn.execute(
                    "INSERT INTO skills (name, description, body, updated_at) VALUES (?1, ?2, ?3, ?4)",
                    params![name, description, body, now_ms()],
                )?;
                conn.last_insert_rowid()
            }
        };
        drop(conn);
        Ok(self.load(saved)?.summary)
    }

    pub fn set_enabled(&self, id: i64, enabled: bool) -> Result<()> {
        if self.conn.lock().execute("UPDATE skills SET enabled = ?1 WHERE id = ?2", params![enabled, id])? == 0 {
            return Err(Error::NotFound(SKILL, id));
        }
        Ok(())
    }

    pub fn delete(&self, id: i64) -> Result<()> {
        self.conn.lock().execute("DELETE FROM skills WHERE id = ?1", [id])?;
        Ok(())
    }

    pub fn stored_bytes(&self) -> Result<u64> {
        Ok(self.list()?.iter().map(|skill| skill.bytes).sum())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const QUIZ: &str = "---\nname: quiz\ndescription: Make a quiz\n---\nAsk five questions.";

    #[test]
    fn installing_a_taken_name_keeps_the_existing_skill() {
        let store = SkillStore::open_in_memory().unwrap();
        let first = store.install(QUIZ, Some("https://example.com/SKILL.md"), None).unwrap();
        let refused = store.install(&QUIZ.replace("five", "ten"), None, None).unwrap_err();
        assert_eq!(refused.to_string(), "There's already a skill called “quiz”.");
        assert_eq!(store.load(first.id).unwrap().body, "Ask five questions.");
        assert_eq!(store.list().unwrap().len(), 1);
    }

    #[test]
    fn only_enabled_skills_can_be_found_by_name() {
        let store = SkillStore::open_in_memory().unwrap();
        let skill = store.install(QUIZ, None, None).unwrap();
        assert!(store.find_enabled("Quiz").unwrap().is_some());
        store.set_enabled(skill.id, false).unwrap();
        assert!(store.find_enabled("quiz").unwrap().is_none());
    }

    #[test]
    fn saving_creates_edits_and_refuses_duplicate_names() {
        let store = SkillStore::open_in_memory().unwrap();
        let notes = store.save(None, "Meeting notes", "Summaries", "Summarize.").unwrap();
        assert_eq!(notes.name, "meeting-notes");
        let quiz = store.save(None, "quiz", "Quizzes", "Ask.").unwrap();
        assert!(store.save(Some(quiz.id), "meeting notes", "Quizzes", "Ask.").is_err());
        let renamed = store.save(Some(quiz.id), "flash cards", "Cards", "Make cards.").unwrap();
        assert_eq!((renamed.id, renamed.name.as_str()), (quiz.id, "flash-cards"));
        assert!(store.save(None, "", "x", "y").is_err());
        assert!(store.save(Some(999), "z", "x", "y").is_err());
    }

    #[test]
    fn deleting_removes_the_skill_and_its_bytes() {
        let store = SkillStore::open_in_memory().unwrap();
        let skill = store.install(QUIZ, None, None).unwrap();
        assert!(store.stored_bytes().unwrap() > 0);
        store.delete(skill.id).unwrap();
        assert!(store.list().unwrap().is_empty());
        assert_eq!(store.stored_bytes().unwrap(), 0);
        assert!(store.load(skill.id).is_err());
    }
}
