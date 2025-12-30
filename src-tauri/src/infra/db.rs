use deadpool_sqlite::{Config as DbConfig, Pool as DbPool, Runtime as DbRuntime};
use once_cell::sync::OnceCell;
use std::path::PathBuf;
use std::sync::Mutex;

use crate::error::AppError;

static CACHE_DB_POOL: OnceCell<DbPool> = OnceCell::new();
static DATA_DB_POOL: OnceCell<DbPool> = OnceCell::new();
static CACHE_DB_PATH: OnceCell<Mutex<Option<PathBuf>>> = OnceCell::new();
static DATA_DB_PATH: OnceCell<Mutex<Option<PathBuf>>> = OnceCell::new();

/// Helper to execute multiple SQL statements in a single transaction
async fn execute_sql_batch(pool: &DbPool, statements: Vec<String>) -> Result<(), AppError> {
    let conn = pool.get().await?;
    conn.interact(move |conn| -> Result<(), rusqlite::Error> {
        for sql in &statements {
            conn.execute(sql, [])?;
        }
        Ok(())
    })
    .await??;
    Ok(())
}

async fn create_cache_tables(pool: &DbPool) -> Result<(), AppError> {
    execute_sql_batch(
        pool,
        vec![r#"
            CREATE TABLE IF NOT EXISTS cache (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                etag TEXT,
                last_modified TEXT,
                updated_at INTEGER NOT NULL,
                expires_at INTEGER NOT NULL
            )
        "#
        .to_string()],
    )
    .await
}

async fn create_data_tables(pool: &DbPool) -> Result<(), AppError> {
    execute_sql_batch(
        pool,
        vec![
            r#"
                CREATE TABLE IF NOT EXISTS subscriptions (
                    subject_id  INTEGER PRIMARY KEY,
                    added_at    INTEGER NOT NULL,
                    notify      INTEGER NOT NULL DEFAULT 0,
                    last_seen_ep INTEGER NOT NULL DEFAULT 0
                )
            "#
            .to_string(),
            r#"
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
                )
            "#
            .to_string(),
            "CREATE INDEX IF NOT EXISTS idx_subjects_name ON subjects_index(LOWER(name))"
                .to_string(),
            "CREATE INDEX IF NOT EXISTS idx_subjects_name_cn ON subjects_index(LOWER(name_cn))"
                .to_string(),
            "CREATE INDEX IF NOT EXISTS idx_subjects_tags ON subjects_index(tags_csv)".to_string(),
            r#"
                CREATE TABLE IF NOT EXISTS mikan_bangumi_map (
                    bgm_subject_id   INTEGER PRIMARY KEY,
                    mikan_bangumi_id INTEGER NOT NULL,
                    confidence       REAL    NOT NULL,
                    source           TEXT    NOT NULL,
                    locked           INTEGER NOT NULL DEFAULT 0,
                    updated_at       INTEGER NOT NULL
                )
            "#
            .to_string(),
            r#"
                CREATE TABLE IF NOT EXISTS tracked_downloads (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    hash TEXT NOT NULL UNIQUE,
                    subject_id INTEGER NOT NULL,
                    episode INTEGER,
                    meta_json TEXT,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                )
            "#
            .to_string(),
        ],
    )
    .await
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

    create_cache_tables(cache_pool).await?;
    create_data_tables(data_pool).await?;

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
