use crate::error::AppError;
use crate::models::download::DownloadTask;
use rusqlite::{params, Connection, OptionalExtension};

fn ensure_table(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS download_tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            anime_id INTEGER NOT NULL,
            episode_id INTEGER NOT NULL,
            info_hash TEXT NOT NULL,
            magnet_url TEXT NOT NULL,
            save_path TEXT NOT NULL,
            status TEXT NOT NULL,
            metadata TEXT NOT NULL,
            created_at INTEGER NOT NULL
        )",
        [],
    )?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_download_tasks_anime_id ON download_tasks(anime_id)",
        [],
    )?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_download_tasks_info_hash ON download_tasks(info_hash)",
        [],
    )?;
    Ok(())
}

pub async fn list() -> Result<Vec<DownloadTask>, AppError> {
    let pool = crate::infra::db::data_pool()?;
    let conn = pool.get().await?;
    conn.interact(|conn| {
        ensure_table(conn)?;
        let mut stmt = conn.prepare("SELECT id, anime_id, episode_id, info_hash, magnet_url, save_path, status, metadata, created_at FROM download_tasks ORDER BY created_at DESC")?;
        let task_iter = stmt.query_map([], |row| {
            Ok(DownloadTask {
                id: row.get(0)?,
                anime_id: row.get(1)?,
                episode_id: row.get(2)?,
                info_hash: row.get(3)?,
                magnet_url: row.get(4)?,
                save_path: row.get(5)?,
                status: row.get(6)?,
                metadata: row.get(7)?,
                created_at: row.get(8)?,
            })
        })?;
        let mut tasks = Vec::new();
        for task in task_iter {
            tasks.push(task?);
        }
        Ok::<Vec<DownloadTask>, rusqlite::Error>(tasks)
    }).await?
    .map_err(Into::into)
}

pub async fn add(task: DownloadTask) -> Result<i64, AppError> {
    let pool = crate::infra::db::data_pool()?;
    let conn = pool.get().await?;
    conn.interact(move |conn| {
        ensure_table(conn)?;
        conn.execute(
            "INSERT INTO download_tasks (anime_id, episode_id, info_hash, magnet_url, save_path, status, metadata, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                task.anime_id,
                task.episode_id,
                task.info_hash,
                task.magnet_url,
                task.save_path,
                task.status,
                task.metadata,
                task.created_at
            ],
        )?;
        Ok::<i64, rusqlite::Error>(conn.last_insert_rowid())
    }).await?
    .map_err(Into::into)
}

pub async fn delete(id: i64) -> Result<(), AppError> {
    let pool = crate::infra::db::data_pool()?;
    let conn = pool.get().await?;
    conn.interact(move |conn| {
        ensure_table(conn)?;
        conn.execute("DELETE FROM download_tasks WHERE id = ?1", params![id])?;
        Ok::<(), rusqlite::Error>(())
    })
    .await?
    .map_err(Into::into)
}

pub async fn get_by_info_hash(info_hash: String) -> Result<Option<DownloadTask>, AppError> {
    let pool = crate::infra::db::data_pool()?;
    let conn = pool.get().await?;
    conn.interact(move |conn| {
        ensure_table(conn)?;
        let mut stmt = conn.prepare("SELECT id, anime_id, episode_id, info_hash, magnet_url, save_path, status, metadata, created_at FROM download_tasks WHERE info_hash = ?1")?;
        stmt.query_row(params![info_hash], |row| {
            Ok(DownloadTask {
                id: row.get(0)?,
                anime_id: row.get(1)?,
                episode_id: row.get(2)?,
                info_hash: row.get(3)?,
                magnet_url: row.get(4)?,
                save_path: row.get(5)?,
                status: row.get(6)?,
                metadata: row.get(7)?,
                created_at: row.get(8)?,
            })
        }).optional()
    }).await?
    .map_err(Into::into)
}

pub async fn update_status(info_hash: String, status: String) -> Result<(), AppError> {
    let pool = crate::infra::db::data_pool()?;
    let conn = pool.get().await?;
    conn.interact(move |conn| {
        ensure_table(conn)?;
        conn.execute(
            "UPDATE download_tasks SET status = ?1 WHERE info_hash = ?2",
            params![status, info_hash],
        )?;
        Ok::<(), rusqlite::Error>(())
    })
    .await?
    .map_err(Into::into)
}

pub async fn get(id: i64) -> Result<Option<DownloadTask>, AppError> {
    let pool = crate::infra::db::data_pool()?;
    let conn = pool.get().await?;
    conn.interact(move |conn| {
        ensure_table(conn)?;
        let mut stmt = conn.prepare("SELECT id, anime_id, episode_id, info_hash, magnet_url, save_path, status, metadata, created_at FROM download_tasks WHERE id = ?1")?;
        stmt.query_row(params![id], |row| {
            Ok(DownloadTask {
                id: row.get(0)?,
                anime_id: row.get(1)?,
                episode_id: row.get(2)?,
                info_hash: row.get(3)?,
                magnet_url: row.get(4)?,
                save_path: row.get(5)?,
                status: row.get(6)?,
                metadata: row.get(7)?,
                created_at: row.get(8)?,
            })
        }).optional()
    }).await?
    .map_err(Into::into)
}
