pub const CREATE_TAB_GROUP_TABLES: &str = "
CREATE TABLE tab_groups (
    position INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    collapsed INTEGER NOT NULL
) STRICT;
CREATE TABLE tab_group_tabs (
    group_position INTEGER NOT NULL,
    position INTEGER NOT NULL,
    path TEXT NOT NULL,
    PRIMARY KEY (group_position, position)
) STRICT, WITHOUT ROWID;";

pub const CREATE_TAB_SESSION_TABLE: &str = "
CREATE TABLE tab_session (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    data TEXT NOT NULL
) STRICT;";
