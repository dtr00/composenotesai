use crate::shared::db::Migration;

pub const CREATE_NOTES_TABLE: &str = "
CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    body BLOB NOT NULL,
    dict_id INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);";

pub const ADD_FOLDERS: &str = "
CREATE TABLE folders (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    parent_id INTEGER REFERENCES folders (id),
    position INTEGER NOT NULL,
    collapsed INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE notes ADD COLUMN folder_id INTEGER REFERENCES folders (id);
ALTER TABLE notes ADD COLUMN position INTEGER NOT NULL DEFAULT 0;
UPDATE notes SET position = ranked.position
FROM (SELECT id, row_number() OVER (ORDER BY title COLLATE NOCASE, id) - 1 AS position FROM notes) AS ranked
WHERE notes.id = ranked.id;";

pub const ADD_TRASH: &str = "
CREATE TABLE trash (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    deleted_at INTEGER NOT NULL,
    is_folder INTEGER NOT NULL,
    entry_id INTEGER NOT NULL
);
ALTER TABLE notes ADD COLUMN trash_id INTEGER REFERENCES trash (id);
ALTER TABLE folders ADD COLUMN trash_id INTEGER REFERENCES trash (id);";

pub const ADD_LIVE_VIEWS: &str = "
CREATE VIEW live_notes AS SELECT * FROM notes WHERE trash_id IS NULL;
CREATE VIEW live_folders AS SELECT * FROM folders WHERE trash_id IS NULL;";

pub const ADD_MEDIA: &str = "
CREATE TABLE media (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    mime TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    folder_id INTEGER REFERENCES folders (id),
    position INTEGER NOT NULL,
    trash_id INTEGER REFERENCES trash (id),
    data BLOB NOT NULL
);
CREATE VIEW live_media AS SELECT * FROM media WHERE trash_id IS NULL;
ALTER TABLE trash RENAME COLUMN is_folder TO kind;";

pub const ADD_NOTE_FORMAT: Migration = Migration::AddColumn {
    table: "notes",
    column: "format",
    definition: "TEXT NOT NULL DEFAULT 'markdown' CHECK (format IN ('markdown', 'excalidraw'))",
};

#[cfg(test)]
pub(super) const MIGRATIONS: &[Migration] = &[
    Migration::Sql(CREATE_NOTES_TABLE),
    Migration::Sql(ADD_FOLDERS),
    Migration::Sql(ADD_TRASH),
    Migration::Sql(ADD_LIVE_VIEWS),
    Migration::Sql(ADD_MEDIA),
    ADD_NOTE_FORMAT,
];
