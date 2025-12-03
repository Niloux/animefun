use crate::error::AppError;
use crate::infra::time::now_secs;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackedDownload {
    pub id: i64,
    pub hash: String,
    pub subject_id: u32,
    pub episode: Option<u32>,
    pub status: String,
    pub file_path: Option<String>,
    pub meta_json: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

fn ensure_table(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS tracked_downloads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            hash TEXT NOT NULL UNIQUE,
            subject_id INTEGER NOT NULL,
            episode INTEGER,
            status TEXT NOT NULL,
            file_path TEXT,
            meta_json TEXT,
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
    episode: Option<u32>,
    status: &str,
    file_path: Option<&str>,
    meta_json: Option<&str>,
) -> Result<(), AppError> {
    let pool = crate::infra::db::data_pool()?;
    let conn = pool.get().await?;
    let hash = hash.to_string();
    let status = status.to_string();
    let file_path = file_path.map(|s| s.to_string());
    let meta_json = meta_json.map(|s| s.to_string());
    let now = now_secs();

    conn.interact(move |conn| -> Result<(), rusqlite::Error> {
        ensure_table(conn)?;
        conn.execute(
            "INSERT INTO tracked_downloads (hash, subject_id, episode, status, file_path, meta_json, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
             ON CONFLICT(hash) DO UPDATE SET
               subject_id=excluded.subject_id,
               episode=excluded.episode,
               status=excluded.status,
               file_path=excluded.file_path,
               meta_json=excluded.meta_json,
               updated_at=excluded.updated_at",
            params![hash, subject_id, episode, status, file_path, meta_json, now, now],
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
        let mut stmt = conn.prepare("SELECT id, hash, subject_id, episode, status, file_path, meta_json, created_at, updated_at FROM tracked_downloads ORDER BY created_at DESC")?;
        let rows = stmt.query_map([], |row| {
            let ep_opt_i: Option<i64> = row.get(3)?;
            let ep_opt_u: Option<u32> = ep_opt_i.map(|v| v as u32);
            Ok(TrackedDownload {
                id: row.get(0)?,
                hash: row.get(1)?,
                subject_id: row.get(2)?,
                episode: ep_opt_u,
                status: row.get(4)?,
                file_path: row.get(5)?,
                meta_json: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
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
