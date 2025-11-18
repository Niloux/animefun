use rusqlite::{params, Connection};
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::error::AppError;

fn now_secs() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64
}

fn db_file_path() -> Result<PathBuf, AppError> {
    let home = std::env::var("HOME").map_err(|e| std::io::Error::new(std::io::ErrorKind::NotFound, e.to_string()))?;
    let dir = PathBuf::from(home).join(".animefun");
    std::fs::create_dir_all(&dir)?;
    Ok(dir.join("cache.sqlite"))
}

fn ensure_table(conn: &Connection) -> Result<(), AppError> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS cache (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at INTEGER NOT NULL,
            expires_at INTEGER NOT NULL
        )",
        [],
    )?;
    Ok(())
}

pub async fn get(key: &str) -> Result<Option<String>, AppError> {
    let key = key.to_string();
    tokio::task::spawn_blocking(move || {
        let path = db_file_path()?;
        let conn = Connection::open(path)?;
        ensure_table(&conn)?;
        let mut stmt = conn.prepare("SELECT value, expires_at FROM cache WHERE key = ?1")?;
        let mut rows = stmt.query(params![key])?;
        if let Some(row) = rows.next()? {
            let value: String = row.get(0)?;
            let expires_at: i64 = row.get(1)?;
            if now_secs() <= expires_at {
                Ok(Some(value))
            } else {
                let _ = conn.execute("DELETE FROM cache WHERE key = ?1", params![key]);
                Ok(None)
            }
        } else {
            Ok(None)
        }
    })
    .await
    .map_err(|_| std::io::Error::new(std::io::ErrorKind::Other, "join"))?
}

pub async fn set(key: &str, value: String, ttl_secs: i64) -> Result<(), AppError> {
    let key = key.to_string();
    tokio::task::spawn_blocking(move || {
        let path = db_file_path()?;
        let conn = Connection::open(path)?;
        ensure_table(&conn)?;
        let now = now_secs();
        let expires = now + ttl_secs;
        conn.execute(
            "INSERT INTO cache(key, value, updated_at, expires_at) VALUES(?1, ?2, ?3, ?4)
             ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at, expires_at=excluded.expires_at",
            params![key, value, now, expires],
        )?;
        Ok(())
    })
    .await
    .map_err(|_| std::io::Error::new(std::io::ErrorKind::Other, "join"))?
}