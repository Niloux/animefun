use deadpool_sqlite::{Config as DbConfig, Pool as DbPool, Runtime as DbRuntime};
use once_cell::sync::OnceCell;
use std::path::PathBuf;
use std::sync::Mutex;

use crate::error::AppError;

static CACHE_DB_POOL: OnceCell<DbPool> = OnceCell::new();
static DATA_DB_POOL: OnceCell<DbPool> = OnceCell::new();
static CACHE_DB_PATH: OnceCell<Mutex<Option<PathBuf>>> = OnceCell::new();
static DATA_DB_PATH: OnceCell<Mutex<Option<PathBuf>>> = OnceCell::new();

const CACHE_MIGRATIONS: &[&str] = &[r#"
    CREATE TABLE IF NOT EXISTS cache (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        etag TEXT,
        last_modified TEXT,
        updated_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
    );
"#];

const DATA_MIGRATIONS: &[&str] = &[r#"
    CREATE TABLE IF NOT EXISTS subscriptions (
        subject_id  INTEGER PRIMARY KEY,
        added_at    INTEGER NOT NULL,
        notify      INTEGER NOT NULL DEFAULT 0,
        last_seen_ep INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS subjects_index (
        subject_id    INTEGER PRIMARY KEY,
        added_at      INTEGER NOT NULL DEFAULT 0,
        updated_at    INTEGER NOT NULL,
        name          TEXT    NOT NULL,
        name_cn       TEXT    NOT NULL,
        tags_csv      TEXT    NOT NULL DEFAULT '',
        meta_tags_csv TEXT    NOT NULL DEFAULT '',
        rating_score  REAL,
        rating_rank   INTEGER,
        rating_total  INTEGER,
        status_code   INTEGER NOT NULL,
        status_ord    INTEGER NOT NULL,
        cover_url     TEXT    NOT NULL DEFAULT ''
    );

    CREATE INDEX IF NOT EXISTS idx_subjects_name ON subjects_index(LOWER(name));
    CREATE INDEX IF NOT EXISTS idx_subjects_name_cn ON subjects_index(LOWER(name_cn));
    CREATE INDEX IF NOT EXISTS idx_subjects_tags ON subjects_index(tags_csv);

    CREATE TABLE IF NOT EXISTS mikan_bangumi_map (
        bgm_subject_id   INTEGER PRIMARY KEY,
        mikan_bangumi_id INTEGER NOT NULL,
        confidence       REAL    NOT NULL,
        source           TEXT    NOT NULL,
        locked           INTEGER NOT NULL DEFAULT 0,
        updated_at       INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tracked_downloads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hash TEXT NOT NULL UNIQUE,
        subject_id INTEGER NOT NULL,
        episode INTEGER,
        episode_range TEXT,
        meta_json TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    );
"#];

const DATA_LEGACY_COLUMNS: &[(&str, &str, &str)] = &[
    (
        "subscriptions",
        "last_seen_ep",
        "ALTER TABLE subscriptions ADD COLUMN last_seen_ep INTEGER NOT NULL DEFAULT 0",
    ),
    (
        "tracked_downloads",
        "episode_range",
        "ALTER TABLE tracked_downloads ADD COLUMN episode_range TEXT",
    ),
];

async fn migrate(
    pool: &DbPool,
    migrations: &'static [&'static str],
    legacy_columns: &'static [(&'static str, &'static str, &'static str)],
) -> Result<(), AppError> {
    let conn = pool.get().await?;
    conn.interact(move |conn| migrate_connection(conn, migrations, legacy_columns))
        .await??;
    Ok(())
}

fn migrate_connection(
    conn: &mut rusqlite::Connection,
    migrations: &[&str],
    legacy_columns: &[(&str, &str, &str)],
) -> Result<(), AppError> {
    let transaction = conn.transaction()?;
    let current: usize = transaction.query_row("PRAGMA user_version", [], |row| row.get(0))?;

    if current > migrations.len() {
        return Err(AppError::Any(format!(
            "database schema version {current} is newer than supported version {}",
            migrations.len()
        )));
    }

    for (index, sql) in migrations.iter().enumerate().skip(current) {
        transaction.execute_batch(sql)?;
        if index == 0 {
            for (table, column, alter_sql) in legacy_columns {
                let check_sql = format!(
                    "SELECT EXISTS(SELECT 1 FROM pragma_table_info('{table}') WHERE name = ?1)"
                );
                let exists: bool = transaction.query_row(&check_sql, [column], |row| row.get(0))?;
                if !exists {
                    transaction.execute_batch(alter_sql)?;
                }
            }
        }
        transaction.pragma_update(None, "user_version", index + 1)?;
    }

    transaction.commit()?;
    Ok(())
}

pub async fn init_pools(base_dir: PathBuf) -> Result<(), AppError> {
    init_db(
        &CACHE_DB_POOL,
        &CACHE_DB_PATH,
        base_dir.clone(),
        "cache.sqlite",
    )?;
    init_db(&DATA_DB_POOL, &DATA_DB_PATH, base_dir, "data.sqlite")?;

    let cache_pool = cache_pool()?;
    let data_pool = data_pool()?;

    migrate(cache_pool, CACHE_MIGRATIONS, &[]).await?;
    migrate(data_pool, DATA_MIGRATIONS, DATA_LEGACY_COLUMNS).await?;

    Ok(())
}

pub fn cache_pool() -> Result<&'static DbPool, AppError> {
    CACHE_DB_POOL
        .get()
        .ok_or_else(|| std::io::Error::other("pool_uninit").into())
}

pub fn data_pool() -> Result<&'static DbPool, AppError> {
    DATA_DB_POOL
        .get()
        .ok_or_else(|| std::io::Error::other("pool_uninit").into())
}

fn init_db(
    pool_cell: &'static OnceCell<DbPool>,
    path_cell: &'static OnceCell<Mutex<Option<PathBuf>>>,
    base_dir: PathBuf,
    filename: &str,
) -> Result<(), AppError> {
    std::fs::create_dir_all(&base_dir)?;
    let file = base_dir.join(filename);

    if let Some(path_mutex) = path_cell.get() {
        let existing_path = path_mutex.lock().unwrap();
        if let Some(existing) = existing_path.as_ref() {
            if existing != &file {
                return Err(AppError::Any(format!(
                    "database already initialized with different path: {} vs {}",
                    existing.display(),
                    file.display()
                )));
            }
            return Ok(());
        }
    }

    let cfg = DbConfig::new(file.to_string_lossy().to_string());
    let pool = cfg.create_pool(DbRuntime::Tokio1)?;

    let _ = path_cell.get_or_init(|| Mutex::new(Some(file.clone())));

    pool_cell
        .set(pool)
        .map_err(|_| AppError::Any("database already initialized".to_string()))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn upgrades_unversioned_legacy_schema_once() {
        let mut conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE subscriptions (
                subject_id INTEGER PRIMARY KEY,
                added_at INTEGER NOT NULL,
                notify INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE tracked_downloads (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                hash TEXT NOT NULL UNIQUE,
                subject_id INTEGER NOT NULL,
                episode INTEGER,
                meta_json TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );",
        )
        .unwrap();

        migrate_connection(&mut conn, DATA_MIGRATIONS, DATA_LEGACY_COLUMNS).unwrap();
        migrate_connection(&mut conn, DATA_MIGRATIONS, DATA_LEGACY_COLUMNS).unwrap();

        let version: usize = conn
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .unwrap();
        let last_seen_ep: usize = conn
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('subscriptions') WHERE name = 'last_seen_ep'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let episode_range: usize = conn
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('tracked_downloads') WHERE name = 'episode_range'",
                [],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!((version, last_seen_ep, episode_range), (1, 1, 1));
    }
}
