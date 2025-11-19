use rusqlite::{params, Connection};
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use once_cell::sync::OnceCell;

use crate::error::AppError;
use crate::cache;
use crate::models::bangumi::{SubjectStatus, SubjectStatusCode};
use crate::services::bangumi_service;
use tokio::time::{sleep, Duration};

fn now_secs() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64
}

fn db_file_path() -> Result<PathBuf, AppError> {
    if let Some(p) = SUBS_DB_FILE.get() {
        return Ok(p.clone());
    }
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_else(|_| ".".into());
    let dir = PathBuf::from(home).join(".animefun");
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
        let mut stmt = conn.prepare("SELECT subject_id, added_at, notify FROM subscriptions ORDER BY added_at DESC")?;
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

pub async fn toggle(id: u32, notify: Option<bool>) -> Result<bool, AppError> {
    tokio::task::spawn_blocking(move || {
        let path = db_file_path()?;
        let conn = Connection::open(path)?;
        ensure_table(&conn)?;
        let mut stmt = conn.prepare("SELECT 1 FROM subscriptions WHERE subject_id = ?1")?;
        let exists = stmt.exists(params![id as i64])?;
        if exists {
            conn.execute("DELETE FROM subscriptions WHERE subject_id = ?1", params![id as i64])?;
            Ok(false)
        } else {
            let now = now_secs();
            let notify_i = if notify.unwrap_or(false) { 1 } else { 0 };
            conn.execute(
                "INSERT INTO subscriptions(subject_id, added_at, notify) VALUES(?1, ?2, ?3)",
                params![id as i64, now, notify_i],
            )?;
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

static SUBS_DB_FILE: OnceCell<PathBuf> = OnceCell::new();

async fn status_ttl_secs(code: &SubjectStatusCode) -> i64 {
    match code {
        SubjectStatusCode::Airing => 6 * 3600,
        SubjectStatusCode::PreAir => 24 * 3600,
        SubjectStatusCode::Finished => 7 * 24 * 3600,
        SubjectStatusCode::OnHiatus => 24 * 3600,
        SubjectStatusCode::Unknown => 24 * 3600,
    }
}

async fn get_status_cached(id: u32) -> Result<SubjectStatus, AppError> {
    let key = format!("sub:status:{}", id);
    if let Some(s) = cache::get(&key).await? {
        let v: SubjectStatus = serde_json::from_str(&s)?;
        return Ok(v);
    }
    let v = bangumi_service::calc_subject_status(id).await?;
    if let Ok(s) = serde_json::to_string(&v) {
        let ttl = status_ttl_secs(&v.code).await;
        let _ = cache::set(&key, s, ttl).await;
    }
    Ok(v)
}

pub async fn refresh_once() -> Result<(), AppError> {
    let rows = list().await?;
    for (id, _added_at, _notify) in rows.into_iter() {
        let _ = get_status_cached(id).await;
    }
    Ok(())
}

pub fn spawn_refresh_worker() {
    tauri::async_runtime::spawn(async move {
        loop {
            let _ = refresh_once().await;
            sleep(Duration::from_secs(600)).await;
        }
    });
}