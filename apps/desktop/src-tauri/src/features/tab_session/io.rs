use super::model::{Tab, TabGroup, TabSession};
use crate::shared::error::Result;
use crate::shared::lock::Lock;
use rusqlite::{Connection, OptionalExtension};

pub struct TabSessionStore {
    conn: Lock<Connection>,
}

impl TabSessionStore {
    pub fn new(conn: Connection) -> Self {
        Self { conn: Lock::new(conn) }
    }

    pub fn load(&self) -> Result<TabSession> {
        let conn = self.conn.lock();
        let data: Option<String> =
            conn.query_row("SELECT data FROM tab_session WHERE id = 1", [], |r| r.get(0)).optional()?;
        if let Some(data) = data {
            let session: TabSession = serde_json::from_str(&data)?;
            session.validate()?;
            return Ok(session);
        }
        load_legacy_groups(&conn)
    }

    pub fn save(&self, session: &TabSession) -> Result<()> {
        session.validate()?;
        let data = serde_json::to_string(session)?;
        let mut conn = self.conn.lock();
        let tx = conn.transaction()?;
        tx.execute(
            "INSERT INTO tab_session (id, data) VALUES (1, ?1) ON CONFLICT (id) DO UPDATE SET data = excluded.data",
            [data],
        )?;
        tx.execute_batch("DELETE FROM tab_group_tabs; DELETE FROM tab_groups;")?;
        tx.commit()?;
        Ok(())
    }
}

fn load_legacy_groups(conn: &Connection) -> Result<TabSession> {
    let mut stmt = conn.prepare(
        "SELECT g.position, g.name, g.collapsed, t.path FROM tab_groups g
         JOIN tab_group_tabs t ON t.group_position = g.position
         ORDER BY g.position, t.position",
    )?;
    let mut rows = stmt.query([])?;
    let mut session = TabSession::default();
    let mut next_tab_id = 1;
    while let Some(row) = rows.next()? {
        let id = row.get::<_, u32>(0)?;
        if session.groups.last().is_none_or(|group| group.id != id) {
            session.groups.push(TabGroup { id, name: row.get(1)?, collapsed: row.get(2)? });
        }
        session.tabs.push(Tab { id: next_tab_id, entries: vec![row.get(3)?], index: 0, group_id: Some(id) });
        next_tab_id += 1;
    }
    Ok(session)
}

#[cfg(test)]
mod tests {
    use super::super::schema::{CREATE_TAB_GROUP_TABLES, CREATE_TAB_SESSION_TABLE};
    use super::*;
    use crate::shared::db::Migration::Sql;

    fn open_store() -> TabSessionStore {
        let migrations = [Sql(CREATE_TAB_GROUP_TABLES), Sql(CREATE_TAB_SESSION_TABLE)];
        TabSessionStore::new(crate::shared::db::open_in_memory(&migrations).unwrap())
    }

    fn session() -> TabSession {
        TabSession {
            tabs: vec![
                Tab { id: 4, entries: vec!["/notes/3".into(), "/settings".into()], index: 1, group_id: None },
                Tab { id: 8, entries: vec!["/".into()], index: 0, group_id: Some(2) },
            ],
            groups: vec![TabGroup { id: 2, name: "Ideas".into(), collapsed: true }],
            active_id: Some(4),
        }
    }

    #[test]
    fn empty_store_loads_empty_session() {
        assert_eq!(open_store().load().unwrap(), TabSession::default());
    }

    #[test]
    fn session_round_trips_with_history_order_and_active_tab() {
        let store = open_store();
        let session = session();
        store.save(&session).unwrap();
        assert_eq!(store.load().unwrap(), session);
    }

    #[test]
    fn empty_session_replaces_previous_tabs() {
        let store = open_store();
        store.save(&session()).unwrap();
        store.save(&TabSession::default()).unwrap();
        assert_eq!(store.load().unwrap(), TabSession::default());
    }

    #[test]
    fn legacy_groups_migrate_without_losing_order_or_blank_tabs() {
        let store = open_store();
        store
            .conn
            .lock()
            .execute_batch(
                "INSERT INTO tab_groups VALUES (0, 'Work', 1), (2, 'Ideas', 0);
                 INSERT INTO tab_group_tabs VALUES (0, 0, '/notes/3'), (0, 1, '/'), (2, 0, '/folders/2');",
            )
            .unwrap();
        let loaded = store.load().unwrap();
        let paths: Vec<&str> = loaded.tabs.iter().map(|tab| tab.entries[0].as_str()).collect();
        assert_eq!(paths, ["/notes/3", "/", "/folders/2"]);
        assert_eq!(
            loaded.groups,
            [
                TabGroup { id: 0, name: "Work".into(), collapsed: true },
                TabGroup { id: 2, name: "Ideas".into(), collapsed: false },
            ]
        );
        store.save(&loaded).unwrap();
        assert_eq!(store.load().unwrap(), loaded);
        store.save(&TabSession::default()).unwrap();
        assert_eq!(store.load().unwrap(), TabSession::default());
    }

    #[test]
    fn invalid_session_does_not_replace_saved_tabs() {
        let store = open_store();
        store.save(&session()).unwrap();
        let mut invalid = session();
        invalid.tabs[0].index = 5;
        assert!(store.save(&invalid).is_err());
        assert_eq!(store.load().unwrap(), session());
    }
}
