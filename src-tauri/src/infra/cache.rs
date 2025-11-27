use rusqlite::{params, Connection};
use std::path::PathBuf;

use crate::error::AppError;
use crate::infra::time::now_secs;
use tracing::{debug, info};

pub fn init(base_dir: PathBuf) -> Result<(), AppError> {
    crate::infra::db::init_cache_db(base_dir)?;
    Ok(())
}

fn ensure_table(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS cache (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            etag TEXT,
            last_modified TEXT,
            updated_at INTEGER NOT NULL,
            expires_at INTEGER NOT NULL
        )",
        [],
    )?;
    Ok(())
}

pub async fn get_entry(
    key: &str,
) -> Result<Option<(String, Option<String>, Option<String>)>, AppError> {
    let pool = crate::infra::db::cache_pool()?;
    let key = key.to_string();
    let conn = pool.get().await?;
    let out =
        conn
            .interact(
                move |conn| -> Result<
                    Option<(String, Option<String>, Option<String>)>,
                    rusqlite::Error,
                > {
                    ensure_table(conn)?;
                    let mut stmt = conn.prepare(
                        "SELECT value, expires_at, etag, last_modified FROM cache WHERE key = ?1",
                    )?;
                    let mut rows = stmt.query(params![key.clone()])?;
                    if let Some(row) = rows.next()? {
                        let expires_at: i64 = row.get(1)?;
                        if now_secs() <= expires_at {
                            let value: String = row.get(0)?;
                            let etag: Option<String> = row.get(2)?;
                            let last_modified: Option<String> = row.get(3)?;
                            debug!(key, "cache hit");
                            Ok(Some((value, etag, last_modified)))
                        } else {
                            let _ = conn.execute("DELETE FROM cache WHERE key = ?1", params![key]);
                            debug!("cache expired and deleted");
                            Ok(None)
                        }
                    } else {
                        Ok(None)
                    }
                },
            )
            .await??;
    Ok(out)
}

pub async fn set_entry(
    key: &str,
    value: String,
    etag: Option<String>,
    last_modified: Option<String>,
    ttl_secs: i64,
) -> Result<(), AppError> {
    let pool = crate::infra::db::cache_pool()?;
    let key = key.to_string();
    let conn = pool.get().await?;
    conn.interact(move |conn| -> Result<(), rusqlite::Error> {
        ensure_table(conn)?;
        let now = now_secs();
        let ttl = if ttl_secs <= 0 { 1 } else { ttl_secs };
        let expires = now + ttl;
        conn.execute(
            "INSERT INTO cache(key, value, updated_at, expires_at, etag, last_modified) VALUES(?1, ?2, ?3, ?4, ?5, ?6)
                ON CONFLICT(key) DO UPDATE SET 
                value=excluded.value, 
                updated_at=excluded.updated_at, 
                expires_at=excluded.expires_at,
                etag=excluded.etag,
                last_modified=excluded.last_modified",
            params![key, value, now, expires, etag, last_modified],
        )?;
        let _ = conn.execute("DELETE FROM cache WHERE expires_at < ?1", params![now]);
        info!("cache upsert and cleanup");
        Ok(())
    })
    .await??;
    Ok(())
}

