use once_cell::sync::OnceCell;
use rusqlite::{params, Connection};
use std::path::PathBuf;

use crate::error::AppError;
use crate::infra::path::default_app_dir;
use crate::infra::time::now_secs;

static DB_FILE: OnceCell<PathBuf> = OnceCell::new();

fn db_file_path() -> Result<PathBuf, AppError> {
    if let Some(p) = DB_FILE.get() {
        return Ok(p.clone());
    }
    let dir = default_app_dir();
    std::fs::create_dir_all(&dir)?;
    let file = dir.join("data.sqlite");
    DB_FILE.set(file.clone()).ok();
    Ok(file)
}

pub fn init(base_dir: PathBuf) -> Result<(), AppError> {
    std::fs::create_dir_all(&base_dir)?;
    let file = base_dir.join("data.sqlite");
    DB_FILE.set(file).ok();
    Ok(())
}

fn ensure_table(conn: &Connection) -> Result<(), AppError> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS mikan_bangumi_map (
            bgm_subject_id   INTEGER PRIMARY KEY,
            mikan_bangumi_id INTEGER NOT NULL,
            confidence       REAL    NOT NULL,
            source           TEXT    NOT NULL,
            locked           INTEGER NOT NULL DEFAULT 0,
            updated_at       INTEGER NOT NULL
        )",
        [],
    )?;
    Ok(())
}

pub async fn get(subject_id: u32) -> Result<Option<u32>, AppError> {
    let id = subject_id as i64;
    tokio::task::spawn_blocking(move || {
        let path = db_file_path()?;
        let conn = Connection::open(path)?;
        ensure_table(&conn)?;
        let mut stmt = conn
            .prepare("SELECT mikan_bangumi_id FROM mikan_bangumi_map WHERE bgm_subject_id = ?1")?;
        let mut rows = stmt.query(params![id])?;
        if let Some(row) = rows.next()? {
            let mid: i64 = row.get(0)?;
            Ok(Some(mid as u32))
        } else {
            Ok(None)
        }
    })
    .await
    .map_err(|_| std::io::Error::other("join"))?
}

pub async fn upsert(
    subject_id: u32,
    mikan_id: u32,
    confidence: f32,
    source: &str,
    locked: bool,
) -> Result<(), AppError> {
    let sid = subject_id as i64;
    let mid = mikan_id as i64;
    let conf = confidence as f64;
    let src = source.to_string();
    let lck = if locked { 1_i64 } else { 0_i64 };
    tokio::task::spawn_blocking(move || {
        let path = db_file_path()?;
        let conn = Connection::open(path)?;
        ensure_table(&conn)?;
        let now = now_secs();
        conn.execute(
            "INSERT INTO mikan_bangumi_map(bgm_subject_id, mikan_bangumi_id, confidence, source, locked, updated_at) VALUES(?1, ?2, ?3, ?4, ?5, ?6)
             ON CONFLICT(bgm_subject_id) DO UPDATE SET mikan_bangumi_id=excluded.mikan_bangumi_id, confidence=excluded.confidence, source=excluded.source, locked=excluded.locked, updated_at=excluded.updated_at",
            params![sid, mid, conf, src, lck, now],
        )?;
        Ok(())
    })
    .await
    .map_err(|_| std::io::Error::other("join"))?
}
