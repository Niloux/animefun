use once_cell::sync::OnceCell;
use rusqlite::{params, Connection};
use std::path::PathBuf;

use crate::error::AppError;
use crate::infra::time::now_secs;
use deadpool_sqlite::{Config as DbConfig, Pool as DbPool, Runtime as DbRuntime};
use tracing::{debug, info};

pub fn init(base_dir: PathBuf) -> Result<(), AppError> {
    std::fs::create_dir_all(&base_dir)?;
    let file = base_dir.join("cache.sqlite");
    DB_FILE.set(file.clone()).ok();
    let cfg = DbConfig::new(file.to_string_lossy().to_string());
    let pool = cfg.create_pool(DbRuntime::Tokio1)?;
    DB_POOL.set(pool).ok();
    Ok(())
}

fn ensure_table(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS cache (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at INTEGER NOT NULL,
            expires_at INTEGER NOT NULL
        )",
        [],
    )?;
    conn.execute(
        "CREATE TABLE IF NOT EXISTS meta (
            key TEXT PRIMARY KEY,
            etag TEXT,
            last_modified TEXT
        )",
        [],
    )?;
    Ok(())
}

pub async fn get(key: &str) -> Result<Option<String>, AppError> {
    let pool = DB_POOL
        .get()
        .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::Other, "pool_uninit"))?;
    let key = key.to_string();
    let conn = pool.get().await?;
    let out = conn
        .interact(move |conn| -> Result<Option<String>, rusqlite::Error> {
            ensure_table(conn)?;
            let mut stmt = conn.prepare("SELECT value, expires_at FROM cache WHERE key = ?1")?;
            let mut rows = stmt.query(params![key])?;
            if let Some(row) = rows.next()? {
                let value: String = row.get(0)?;
                let expires_at: i64 = row.get(1)?;
                if now_secs() <= expires_at {
                    debug!("cache hit");
                    Ok(Some(value))
                } else {
                    let _ = conn.execute("DELETE FROM cache WHERE key = ?1", params![key]);
                    debug!("cache expired and deleted");
                    Ok(None)
                }
            } else {
                Ok(None)
            }
        })
        .await??;
    Ok(out)
}

pub async fn set(key: &str, value: String, ttl_secs: i64) -> Result<(), AppError> {
    let pool = DB_POOL
        .get()
        .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::Other, "pool_uninit"))?;
    let key = key.to_string();
    let conn = pool.get().await?;
    conn
        .interact(move |conn| -> Result<(), rusqlite::Error> {
            ensure_table(conn)?;
            let now = now_secs();
            let ttl = if ttl_secs <= 0 { 1 } else { ttl_secs };
            let expires = now + ttl;
            conn.execute(
                "INSERT INTO cache(key, value, updated_at, expires_at) VALUES(?1, ?2, ?3, ?4)
                 ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at, expires_at=excluded.expires_at",
                params![key, value, now, expires],
            )?;
            let _ = conn.execute("DELETE FROM cache WHERE expires_at < ?1", params![now]);
            info!("cache upsert and cleanup");
            Ok(())
        })
        .await??;
    Ok(())
}

pub async fn get_meta(key: &str) -> Result<(Option<String>, Option<String>), AppError> {
    let pool = DB_POOL
        .get()
        .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::Other, "pool_uninit"))?;
    let key = key.to_string();
    let conn = pool.get().await?;
    let out = conn
        .interact(
            move |conn| -> Result<(Option<String>, Option<String>), rusqlite::Error> {
                ensure_table(conn)?;
                let mut stmt =
                    conn.prepare("SELECT etag, last_modified FROM meta WHERE key = ?1")?;
                let mut rows = stmt.query(params![key])?;
                if let Some(row) = rows.next()? {
                    let etag: Option<String> = row.get(0)?;
                    let last_modified: Option<String> = row.get(1)?;
                    Ok((etag, last_modified))
                } else {
                    Ok((None, None))
                }
            },
        )
        .await??;
    Ok(out)
}

pub async fn set_meta(
    key: &str,
    etag: Option<String>,
    last_modified: Option<String>,
) -> Result<(), AppError> {
    let pool = DB_POOL
        .get()
        .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::Other, "pool_uninit"))?;
    let key = key.to_string();
    let conn = pool.get().await?;
    conn
        .interact(move |conn| -> Result<(), rusqlite::Error> {
            ensure_table(conn)?;
            conn.execute(
                "INSERT INTO meta(key, etag, last_modified) VALUES(?1, ?2, ?3)
                 ON CONFLICT(key) DO UPDATE SET etag=excluded.etag, last_modified=excluded.last_modified",
                params![key, etag, last_modified],
            )?;
            Ok(())
        })
        .await??;
    Ok(())
}
static DB_FILE: OnceCell<PathBuf> = OnceCell::new();
static DB_POOL: OnceCell<DbPool> = OnceCell::new();

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::time::{sleep, Duration};

    #[tokio::test]
    async fn test_cache_set_get_expire_and_delete() {
        let dir = crate::infra::path::default_app_dir();
        let _ = init(dir);
        let k = "__test_key__";
        let v = "__test_value__".to_string();
        let _ = set(k, v, 1).await.unwrap();
        let v1 = get(k).await.unwrap();
        assert!(v1.is_some());
        sleep(Duration::from_secs(2)).await;
        let v2 = get(k).await.unwrap();
        assert!(v2.is_none());
    }
}
