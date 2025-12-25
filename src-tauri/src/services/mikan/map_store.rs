use rusqlite::params;

use crate::error::AppError;
use crate::infra::time::now_secs;

pub async fn get(subject_id: u32) -> Result<Option<u32>, AppError> {
    let pool = crate::infra::db::data_pool()?;
    let id = subject_id as i64;
    let conn = pool.get().await?;
    let out = conn
        .interact(move |conn| -> Result<Option<u32>, rusqlite::Error> {
            let mut stmt = conn.prepare(
                "SELECT mikan_bangumi_id FROM mikan_bangumi_map WHERE bgm_subject_id = ?1",
            )?;
            let mut rows = stmt.query(params![id])?;
            if let Some(row) = rows.next()? {
                let mid: i64 = row.get(0)?;
                Ok(Some(mid as u32))
            } else {
                Ok(None)
            }
        })
        .await??;
    Ok(out)
}

pub async fn upsert(
    subject_id: u32,
    mikan_id: u32,
    confidence: f32,
    source: &str,
    locked: bool,
) -> Result<(), AppError> {
    let pool = crate::infra::db::data_pool()?;
    let sid = subject_id as i64;
    let mid = mikan_id as i64;
    let conf = confidence as f64;
    let src = source.to_string();
    let lck = if locked { 1_i64 } else { 0_i64 };
    let conn = pool.get().await?;
    conn
        .interact(move |conn| -> Result<(), rusqlite::Error> {
            let now = now_secs();
            conn.execute(
                "INSERT INTO mikan_bangumi_map(bgm_subject_id, mikan_bangumi_id, confidence, source, locked, updated_at) VALUES(?1, ?2, ?3, ?4, ?5, ?6)
                 ON CONFLICT(bgm_subject_id) DO UPDATE SET mikan_bangumi_id=excluded.mikan_bangumi_id, confidence=excluded.confidence, source=excluded.source, locked=excluded.locked, updated_at=excluded.updated_at",
                params![sid, mid, conf, src, lck, now],
            )?;
            Ok(())
        })
        .await??;
    Ok(())
}
