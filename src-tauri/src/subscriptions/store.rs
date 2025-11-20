use once_cell::sync::OnceCell;
use rusqlite::{params, Connection};
use std::path::PathBuf;

use crate::error::AppError;
use crate::infra::path::default_app_dir;
use crate::infra::time::now_secs;
use tracing::info;

static SUBS_DB_FILE: OnceCell<PathBuf> = OnceCell::new();

fn db_file_path() -> Result<PathBuf, AppError> {
    if let Some(p) = SUBS_DB_FILE.get() {
        return Ok(p.clone());
    }
    let dir = default_app_dir();
    std::fs::create_dir_all(&dir)?;
    let file = dir.join("data.sqlite");
    SUBS_DB_FILE.set(file.clone()).ok();
    Ok(file)
}

pub fn init(base_dir: PathBuf) -> Result<(), AppError> {
    std::fs::create_dir_all(&base_dir)?;
    let file = base_dir.join("data.sqlite");
    SUBS_DB_FILE.set(file).ok();
    Ok(())
}

fn ensure_table(conn: &Connection) -> Result<(), AppError> {
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
    tokio::task::spawn_blocking(move || {
        let path = db_file_path()?;
        let conn = Connection::open(path)?;
        ensure_table(&conn)?;
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
    .await
    .map_err(|_| std::io::Error::new(std::io::ErrorKind::Other, "join"))?
}

pub async fn list_ids() -> Result<Vec<u32>, AppError> {
    tokio::task::spawn_blocking(move || {
        let path = db_file_path()?;
        let conn = Connection::open(path)?;
        ensure_table(&conn)?;
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
    .await
    .map_err(|_| std::io::Error::new(std::io::ErrorKind::Other, "join"))?
}

pub async fn has(id: u32) -> Result<bool, AppError> {
    tokio::task::spawn_blocking(move || {
        let path = db_file_path()?;
        let conn = Connection::open(path)?;
        ensure_table(&conn)?;
        let mut stmt = conn.prepare("SELECT 1 FROM subscriptions WHERE subject_id = ?1")?;
        let exists = stmt.exists(params![id as i64])?;
        Ok(exists)
    })
    .await
    .map_err(|_| std::io::Error::new(std::io::ErrorKind::Other, "join"))?
}

pub async fn toggle(id: u32, notify: Option<bool>) -> Result<bool, AppError> {
    tokio::task::spawn_blocking(move || {
        let path = db_file_path()?;
        let conn = Connection::open(path)?;
        ensure_table(&conn)?;
        let mut stmt = conn.prepare("SELECT 1 FROM subscriptions WHERE subject_id = ?1")?;
        let exists = stmt.exists(params![id as i64])?;
        if exists {
            conn.execute(
                "DELETE FROM subscriptions WHERE subject_id = ?1",
                params![id as i64],
            )?;
            info!(id, "unsubscribe");
            Ok(false)
        } else {
            let now = now_secs();
            let notify_i = if notify.unwrap_or(false) { 1 } else { 0 };
            conn.execute(
                "INSERT INTO subscriptions(subject_id, added_at, notify) VALUES(?1, ?2, ?3)",
                params![id as i64, now, notify_i],
            )?;
            info!(id, notify=%(notify.unwrap_or(false)), "subscribe");
            Ok(true)
        }
    })
    .await
    .map_err(|_| std::io::Error::new(std::io::ErrorKind::Other, "join"))?
}

pub async fn clear() -> Result<(), AppError> {
    tokio::task::spawn_blocking(move || {
        let path = db_file_path()?;
        let conn = Connection::open(path)?;
        ensure_table(&conn)?;
        conn.execute("DELETE FROM subscriptions", [])?;
        Ok(())
    })
    .await
    .map_err(|_| std::io::Error::new(std::io::ErrorKind::Other, "join"))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_toggle_list_clear() {
        let dir = default_app_dir();
        let _ = init(dir);
        let _ = clear().await.unwrap();
        let r0 = list().await.unwrap();
        assert!(r0.is_empty());
        let added = toggle(12345, Some(true)).await.unwrap();
        assert!(added);
        let r1 = list().await.unwrap();
        assert_eq!(r1.len(), 1);
        assert_eq!(r1[0].0, 12345);
        let removed = toggle(12345, None).await.unwrap();
        assert!(!removed);
        let r2 = list().await.unwrap();
        assert!(r2.is_empty());
    }
}
