use crate::error::AppError;
use crate::infra::time::now_secs;
use rusqlite::params;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackedDownload {
    pub id: i64,
    pub hash: String,
    pub subject_id: u32,
    pub episode: Option<u32>,
    pub meta_json: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

pub async fn update_meta(hash: String, meta_json: String) -> Result<(), AppError> {
    let pool = crate::infra::db::data_pool()?;
    let conn = pool.get().await?;
    let now = now_secs();
    conn.interact(move |conn| -> Result<(), rusqlite::Error> {
        conn.execute(
            "UPDATE tracked_downloads SET meta_json = ?1, updated_at = ?2 WHERE hash = ?3",
            params![meta_json, now, hash],
        )?;
        Ok(())
    })
    .await??;
    Ok(())
}

pub async fn insert(
    hash: &str,
    subject_id: u32,
    episode: Option<u32>,
    meta_json: Option<&str>,
) -> Result<(), AppError> {
    let pool = crate::infra::db::data_pool()?;
    let conn = pool.get().await?;
    let hash = hash.to_string();
    let meta_json = meta_json.map(|s| s.to_string());
    let now = now_secs();

    conn.interact(move |conn| -> Result<(), rusqlite::Error> {
        conn.execute(
            "INSERT INTO tracked_downloads (hash, subject_id, episode, meta_json, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)
             ON CONFLICT(hash) DO UPDATE SET
               subject_id=excluded.subject_id,
               episode=excluded.episode,
               meta_json=excluded.meta_json,
               updated_at=excluded.updated_at",
            params![hash, subject_id, episode, meta_json, now, now],
        )?;
        Ok(())
    }).await??;
    Ok(())
}

pub async fn list() -> Result<Vec<TrackedDownload>, AppError> {
    let pool = crate::infra::db::data_pool()?;
    let conn = pool.get().await?;

    let items = conn.interact(move |conn| -> Result<Vec<TrackedDownload>, rusqlite::Error> {
        let mut stmt = conn.prepare("SELECT id, hash, subject_id, episode, meta_json, created_at, updated_at FROM tracked_downloads ORDER BY created_at DESC")?;
        let rows = stmt.query_map([], |row| {
            let ep_opt_i: Option<i64> = row.get(3)?;
            let ep_opt_u: Option<u32> = ep_opt_i.map(|v| v as u32);
            Ok(TrackedDownload {
                id: row.get(0)?,
                hash: row.get(1)?,
                subject_id: row.get(2)?,
                episode: ep_opt_u,
                meta_json: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
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
        conn.execute(
            "DELETE FROM tracked_downloads WHERE hash = ?1",
            params![hash],
        )?;
        Ok(())
    })
    .await??;
    Ok(())
}
