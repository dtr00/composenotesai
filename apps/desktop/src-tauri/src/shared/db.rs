use crate::shared::error::Result;
use rusqlite::Connection;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

pub const DATABASE_FILE: &str = "notes.db";
const FULL_AUTO_VACUUM: u32 = 1;
const WAL_SIZE_LIMIT: i64 = 1 << 20;

pub fn now_ms() -> i64 {
    let since_epoch = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    i64::try_from(since_epoch.as_millis()).unwrap_or(i64::MAX)
}

pub fn database_files(data_dir: &Path) -> [PathBuf; 3] {
    let database = data_dir.join(DATABASE_FILE);
    let with_suffix = |suffix: &str| {
        let mut name = database.as_os_str().to_owned();
        name.push(suffix);
        PathBuf::from(name)
    };
    [with_suffix(""), with_suffix("-wal"), with_suffix("-shm")]
}

#[derive(Clone, Copy)]
pub enum Migration {
    Sql(&'static str),
    AddColumn { table: &'static str, column: &'static str, definition: &'static str },
}

impl Migration {
    fn apply(&self, conn: &Connection) -> Result<()> {
        match self {
            Migration::Sql(sql) => conn.execute_batch(sql)?,
            Migration::AddColumn { table, column, definition } => {
                if !conn.column_exists(None, *table, *column)? {
                    conn.execute_batch(&format!("ALTER TABLE {table} ADD COLUMN {column} {definition};"))?;
                }
            }
        }
        Ok(())
    }
}

pub fn open(path: &Path, migrations: &[Migration]) -> Result<Connection> {
    let conn = Connection::open(path)?;
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "journal_size_limit", WAL_SIZE_LIMIT)?;
    conn.pragma_update(None, "synchronous", "NORMAL")?;
    migrate(&conn, migrations)?;
    Ok(conn)
}

pub fn logical_bytes(conn: &Connection) -> Result<u64> {
    let pragma = |name| conn.pragma_query_value(None, name, |r| r.get::<_, i64>(0)).map(i64::unsigned_abs);
    Ok(pragma("page_count")? * pragma("page_size")?)
}

pub fn enable_auto_vacuum(path: &Path) -> Result<()> {
    let conn = Connection::open(path)?;
    if conn.pragma_query_value(None, "auto_vacuum", |r| r.get::<_, u32>(0))? != FULL_AUTO_VACUUM {
        conn.pragma_update(None, "auto_vacuum", FULL_AUTO_VACUUM)?;
        conn.execute_batch("VACUUM")?;
    }
    Ok(())
}

#[cfg(test)]
pub fn open_in_memory(migrations: &[Migration]) -> Result<Connection> {
    let conn = Connection::open_in_memory()?;
    migrate(&conn, migrations)?;
    Ok(conn)
}

pub fn migrate(conn: &Connection, migrations: &[Migration]) -> Result<()> {
    let version: u32 = conn.pragma_query_value(None, "user_version", |r| r.get(0))?;
    for (applied, migration) in (1u32..).zip(migrations).skip(version as usize) {
        let tx = conn.unchecked_transaction()?;
        migration.apply(&tx)?;
        tx.pragma_update(None, "user_version", applied)?;
        tx.commit()?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    const FIRST: Migration = Migration::Sql("CREATE TABLE IF NOT EXISTS a (x INTEGER);");
    const SECOND: Migration = Migration::Sql("CREATE TABLE b (y INTEGER);");
    const ADD_Z: Migration = Migration::AddColumn { table: "a", column: "z", definition: "INTEGER NOT NULL DEFAULT 0" };

    fn version(conn: &Connection) -> u32 {
        conn.pragma_query_value(None, "user_version", |r| r.get(0)).unwrap()
    }

    fn file_pages(conn: &Connection) -> (u32, u32) {
        let pragma = |name| conn.pragma_query_value(None, name, |r| r.get(0)).unwrap();
        (pragma("page_count"), pragma("freelist_count"))
    }

    #[test]
    fn shrinks_existing_database_and_keeps_it_small_after_deletes() {
        let dir = crate::shared::testing::temp_dir("db-vacuum");
        let path = dir.join(DATABASE_FILE);
        let old = open(&path, &[Migration::Sql("CREATE TABLE a (x BLOB);")]).unwrap();
        old.execute_batch("INSERT INTO a VALUES (zeroblob(1000000)); DELETE FROM a;").unwrap();
        assert!(file_pages(&old).1 > 0);
        drop(old);

        enable_auto_vacuum(&path).unwrap();
        let conn = open(&path, &[]).unwrap();
        let empty = file_pages(&conn);
        assert_eq!(empty.1, 0);
        conn.execute_batch("INSERT INTO a VALUES (zeroblob(1000000)); DELETE FROM a;").unwrap();
        assert_eq!(file_pages(&conn), empty);
        drop(conn);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn logical_size_counts_changes_still_in_the_write_ahead_log() {
        let dir = crate::shared::testing::temp_dir("db-logical-size");
        let conn = open(&dir.join(DATABASE_FILE), &[Migration::Sql("CREATE TABLE a (x BLOB);")]).unwrap();
        conn.execute_batch("INSERT INTO a VALUES (zeroblob(100000));").unwrap();
        assert!(logical_bytes(&conn).unwrap() >= 100_000);
        assert!(std::fs::metadata(dir.join(DATABASE_FILE)).unwrap().len() < 100_000);
        drop(conn);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn applies_every_migration_and_records_version() {
        let conn = open_in_memory(&[FIRST, SECOND]).unwrap();
        assert_eq!(version(&conn), 2);
        conn.execute("INSERT INTO b (y) VALUES (1)", []).unwrap();
    }

    #[test]
    fn skips_applied_migrations() {
        let conn = open_in_memory(&[FIRST]).unwrap();
        migrate(&conn, &[FIRST, SECOND]).unwrap();
        migrate(&conn, &[FIRST, SECOND]).unwrap();
        assert_eq!(version(&conn), 2);
    }

    #[test]
    fn upgrades_unversioned_database() {
        let conn = Connection::open_in_memory().unwrap();
        FIRST.apply(&conn).unwrap();
        migrate(&conn, &[FIRST]).unwrap();
        assert_eq!(version(&conn), 1);
        conn.execute("INSERT INTO a (x) VALUES (1)", []).unwrap();
    }

    #[test]
    fn failed_migration_leaves_version_unchanged() {
        let conn = open_in_memory(&[FIRST]).unwrap();
        assert!(migrate(&conn, &[FIRST, Migration::Sql("CREATE TABLE b (y INTEGER); NOT SQL;")]).is_err());
        assert_eq!(version(&conn), 1);
        assert!(conn.execute("INSERT INTO b (y) VALUES (1)", []).is_err());
    }

    #[test]
    fn added_columns_are_kept_when_a_database_already_has_them() {
        let conn = open_in_memory(&[FIRST]).unwrap();
        conn.execute_batch("ALTER TABLE a ADD COLUMN z INTEGER; INSERT INTO a (x, z) VALUES (1, 7);").unwrap();
        migrate(&conn, &[FIRST, ADD_Z]).unwrap();
        assert_eq!(version(&conn), 2);
        assert_eq!(conn.query_row("SELECT z FROM a", [], |r| r.get::<_, i64>(0)).unwrap(), 7);
        let fresh = open_in_memory(&[FIRST, ADD_Z]).unwrap();
        fresh.execute("INSERT INTO a (x) VALUES (1)", []).unwrap();
        assert_eq!(fresh.query_row("SELECT z FROM a", [], |r| r.get::<_, i64>(0)).unwrap(), 0);
    }
}
