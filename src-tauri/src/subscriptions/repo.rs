use rusqlite::{params, Connection};

use crate::error::AppError;
use crate::infra::time::now_secs;

fn ensure_table(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS subscriptions (
            subject_id INTEGER PRIMARY KEY,
            added_at   INTEGER NOT NULL,
            notify     INTEGER NOT NULL DEFAULT 0
        )",
        [],
    )?;
    Ok(())
}

pub async fn list() -> Result<Vec<(u32, i64, bool)>, AppError> {
    let pool = crate::infra::db::data_pool()?;
    let conn = pool.get().await?;
    let out = conn
        .interact(|conn| -> Result<Vec<(u32, i64, bool)>, rusqlite::Error> {
            ensure_table(conn)?;
            let mut stmt = conn.prepare(
                "SELECT subject_id, added_at, notify FROM subscriptions ORDER BY added_at DESC",
            )?;
            let mut rows = stmt.query([])?;
            let mut out = Vec::new();
            while let Some(row) = rows.next()? {
                let id: u32 = row.get::<_, i64>(0)? as u32;
                let added_at: i64 = row.get(1)?;
                let notify_i: i64 = row.get(2)?;
                out.push((id, added_at, notify_i != 0));
            }
            Ok(out)
        })
        .await??;
    Ok(out)
}

pub async fn list_ids() -> Result<Vec<u32>, AppError> {
    let pool = crate::infra::db::data_pool()?;
    let conn = pool.get().await?;
    let out = conn
        .interact(|conn| -> Result<Vec<u32>, rusqlite::Error> {
            ensure_table(conn)?;
            let mut stmt =
                conn.prepare("SELECT subject_id FROM subscriptions ORDER BY added_at DESC")?;
            let mut rows = stmt.query([])?;
            let mut out: Vec<u32> = Vec::new();
            while let Some(row) = rows.next()? {
                let id: u32 = row.get::<_, i64>(0)? as u32;
                out.push(id);
            }
            Ok(out)
        })
        .await??;
    Ok(out)
}

pub async fn has(id: u32) -> Result<bool, AppError> {
    let pool = crate::infra::db::data_pool()?;
    let conn = pool.get().await?;
    let exists = conn
        .interact(move |conn| -> Result<bool, rusqlite::Error> {
            ensure_table(conn)?;
            let mut stmt = conn.prepare("SELECT 1 FROM subscriptions WHERE subject_id = ?1")?;
            let exists = stmt.exists(params![id as i64])?;
            Ok(exists)
        })
        .await??;
    Ok(exists)
}

pub async fn add(id: u32, notify: bool) -> Result<(), AppError> {
    let now = now_secs();
    let pool = crate::infra::db::data_pool()?;
    let conn = pool.get().await?;
    conn.interact(move |conn| -> Result<(), rusqlite::Error> {
        ensure_table(conn)?;
        let notify_i = if notify { 1 } else { 0 };
        conn.execute(
            "INSERT INTO subscriptions(subject_id, added_at, notify) VALUES(?1, ?2, ?3)",
            params![id as i64, now, notify_i],
        )?;
        Ok(())
    })
    .await??;
    Ok(())
}

pub async fn remove(id: u32) -> Result<(), AppError> {
    let pool = crate::infra::db::data_pool()?;
    let conn = pool.get().await?;
    conn.interact(move |conn| -> Result<(), rusqlite::Error> {
        ensure_table(conn)?;
        conn.execute(
            "DELETE FROM subscriptions WHERE subject_id = ?1",
            params![id as i64],
        )?;
        Ok(())
    })
    .await??;
    Ok(())
}

pub async fn clear() -> Result<(), AppError> {
    let pool = crate::infra::db::data_pool()?;
    let conn = pool.get().await?;
    conn.interact(|conn| -> Result<(), rusqlite::Error> {
        ensure_table(conn)?;
        conn.execute("DELETE FROM subscriptions", [])?;
        Ok(())
    })
    .await??;
    Ok(())
}
