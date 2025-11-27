use crate::error::AppError;
use crate::infra::time::now_secs;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackedDownload {
    pub id: i64,
    pub hash: String,
    pub subject_id: u32,
    pub episode: u32,
    pub status: String,
    pub file_path: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

fn ensure_table(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS tracked_downloads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            hash TEXT NOT NULL UNIQUE,
            subject_id INTEGER NOT NULL,
            episode INTEGER NOT NULL,
            status TEXT NOT NULL,
            file_path TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )",
        [],
    )?;
    Ok(())
}

pub async fn insert(
    hash: &str,
    subject_id: u32,
    episode: u32,
    status: &str,
    file_path: Option<&str>,
) -> Result<(), AppError> {
    let pool = crate::infra::db::data_pool()?;
    let conn = pool.get().await?;
    let hash = hash.to_string();
    let status = status.to_string();
    let file_path = file_path.map(|s| s.to_string());
    let now = now_secs();

    conn.interact(move |conn| -> Result<(), rusqlite::Error> {
        ensure_table(conn)?;
        conn.execute(
            "INSERT INTO tracked_downloads (hash, subject_id, episode, status, file_path, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![hash, subject_id, episode, status, file_path, now, now],
        )?;
        Ok(())
    }).await??;
    Ok(())
}

pub async fn list() -> Result<Vec<TrackedDownload>, AppError> {
    let pool = crate::infra::db::data_pool()?;
    let conn = pool.get().await?;

    let items = conn.interact(move |conn| -> Result<Vec<TrackedDownload>, rusqlite::Error> {
        ensure_table(conn)?;
        let mut stmt = conn.prepare("SELECT id, hash, subject_id, episode, status, file_path, created_at, updated_at FROM tracked_downloads ORDER BY created_at DESC")?;
        let rows = stmt.query_map([], |row| {
            Ok(TrackedDownload {
                id: row.get(0)?,
                hash: row.get(1)?,
                subject_id: row.get(2)?,
                episode: row.get(3)?,
                status: row.get(4)?,
                file_path: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r?);
        }
        Ok(out)
    }).await??;
    Ok(items)
}

pub async fn delete(hash: String) -> Result<(), AppError> {
    let pool = crate::infra::db::data_pool()?;
    let conn = pool.get().await?;
    conn.interact(move |conn| -> Result<(), rusqlite::Error> {
        ensure_table(conn)?;
        conn.execute(
            "DELETE FROM tracked_downloads WHERE hash = ?1",
            params![hash],
        )?;
        Ok(())
    })
    .await??;
    Ok(())
}

pub async fn update_status(
    hash: String,
    status: String,
    file_path: Option<String>,
) -> Result<(), AppError> {
    let pool = crate::infra::db::data_pool()?;
    let conn = pool.get().await?;
    let now = now_secs();
    conn.interact(move |conn| -> Result<(), rusqlite::Error> {
        ensure_table(conn)?;
        if let Some(fp) = file_path {
             conn.execute(
                "UPDATE tracked_downloads SET status = ?1, file_path = ?2, updated_at = ?3 WHERE hash = ?4",
                params![status, fp, now, hash],
            )?;
        } else {
             conn.execute(
                "UPDATE tracked_downloads SET status = ?1, updated_at = ?2 WHERE hash = ?3",
                params![status, now, hash],
            )?;
        }
        Ok(())
    }).await??;
    Ok(())
}
