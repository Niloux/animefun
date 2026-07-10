use rusqlite::params;

use crate::error::AppError;
use crate::infra::time::now_secs;
use crate::models::bangumi::{SubjectResponse, SubjectStatusCode};

use super::index_repo;

pub async fn list() -> Result<Vec<(u32, i64, bool, u32, Option<String>)>, AppError> {
    let pool = crate::infra::db::data_pool()?;
    let conn = pool.get().await?;
    let out = conn
        .interact(
            |conn| -> Result<Vec<(u32, i64, bool, u32, Option<String>)>, rusqlite::Error> {
                let mut stmt = conn.prepare(
                    "SELECT s.subject_id, s.added_at, s.notify, s.last_seen_ep, i.name_cn
                 FROM subscriptions s
                 LEFT JOIN subjects_index i ON i.subject_id = s.subject_id
                 ORDER BY s.added_at DESC",
                )?;
                let mut rows = stmt.query([])?;
                let mut out = Vec::new();
                while let Some(row) = rows.next()? {
                    let id: u32 = row.get::<_, i64>(0)? as u32;
                    let added_at: i64 = row.get(1)?;
                    let notify_i: i64 = row.get(2)?;
                    let last_seen_ep: u32 = row.get::<_, i64>(3)? as u32;
                    let name_cn: Option<String> = row.get(4)?;
                    out.push((id, added_at, notify_i != 0, last_seen_ep, name_cn));
                }
                Ok(out)
            },
        )
        .await??;
    Ok(out)
}

pub async fn list_ids() -> Result<Vec<u32>, AppError> {
    let pool = crate::infra::db::data_pool()?;
    let conn = pool.get().await?;
    let out = conn
        .interact(|conn| -> Result<Vec<u32>, rusqlite::Error> {
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
            let mut stmt = conn.prepare("SELECT 1 FROM subscriptions WHERE subject_id = ?1")?;
            let exists = stmt.exists(params![id as i64])?;
            Ok(exists)
        })
        .await??;
    Ok(exists)
}

pub async fn add(
    id: u32,
    notify: bool,
    subject: SubjectResponse,
    status: SubjectStatusCode,
) -> Result<(), AppError> {
    let added_at = now_secs();
    let pool = crate::infra::db::data_pool()?;
    let conn = pool.get().await?;
    conn.interact(move |conn| add_connection(conn, id, notify, added_at, subject, status))
        .await??;
    Ok(())
}

fn add_connection(
    conn: &mut rusqlite::Connection,
    id: u32,
    notify: bool,
    added_at: i64,
    subject: SubjectResponse,
    status: SubjectStatusCode,
) -> Result<(), rusqlite::Error> {
    let transaction = conn.transaction()?;
    transaction.execute(
        "INSERT INTO subscriptions(subject_id, added_at, notify) VALUES(?1, ?2, ?3)",
        params![id as i64, added_at, if notify { 1 } else { 0 }],
    )?;
    index_repo::index_upsert_connection(&transaction, id, added_at, subject, status)?;
    transaction.commit()
}

pub async fn remove(id: u32) -> Result<(), AppError> {
    let pool = crate::infra::db::data_pool()?;
    let conn = pool.get().await?;
    conn.interact(move |conn| remove_connection(conn, id))
        .await??;
    Ok(())
}

fn remove_connection(conn: &mut rusqlite::Connection, id: u32) -> Result<(), rusqlite::Error> {
    let transaction = conn.transaction()?;
    transaction.execute(
        "DELETE FROM subscriptions WHERE subject_id = ?1",
        params![id as i64],
    )?;
    transaction.execute(
        "DELETE FROM subjects_index WHERE subject_id = ?1",
        params![id as i64],
    )?;
    transaction.commit()
}

pub async fn clear() -> Result<(), AppError> {
    let pool = crate::infra::db::data_pool()?;
    let conn = pool.get().await?;
    conn.interact(clear_connection).await??;
    Ok(())
}

fn clear_connection(conn: &mut rusqlite::Connection) -> Result<(), rusqlite::Error> {
    let transaction = conn.transaction()?;
    transaction.execute("DELETE FROM subscriptions", [])?;
    transaction.execute("DELETE FROM subjects_index", [])?;
    transaction.commit()
}

pub async fn get_last_seen_ep(subject_id: u32) -> Result<u32, AppError> {
    let pool = crate::infra::db::data_pool()?;
    let conn = pool.get().await?;
    let last_seen_ep = conn
        .interact(move |conn| -> Result<u32, rusqlite::Error> {
            let mut stmt =
                conn.prepare("SELECT last_seen_ep FROM subscriptions WHERE subject_id = ?1")?;
            let mut rows = stmt.query(params![subject_id as i64])?;
            if let Some(row) = rows.next()? {
                let ep: u32 = row.get::<_, i64>(0)? as u32;
                Ok(ep)
            } else {
                Ok(0)
            }
        })
        .await??;
    Ok(last_seen_ep)
}

pub async fn update_last_seen_ep(subject_id: u32, episode: u32) -> Result<(), AppError> {
    let pool = crate::infra::db::data_pool()?;
    let conn = pool.get().await?;
    conn.interact(move |conn| -> Result<(), rusqlite::Error> {
        conn.execute(
            "UPDATE subscriptions SET last_seen_ep = ?1 WHERE subject_id = ?2",
            params![episode as i64, subject_id as i64],
        )?;
        Ok(())
    })
    .await??;
    Ok(())
}

pub async fn get_notify(subject_id: u32) -> Result<bool, AppError> {
    let pool = crate::infra::db::data_pool()?;
    let conn = pool.get().await?;
    let notify = conn
        .interact(move |conn| -> Result<bool, rusqlite::Error> {
            let mut stmt =
                conn.prepare("SELECT notify FROM subscriptions WHERE subject_id = ?1")?;
            let mut rows = stmt.query(params![subject_id as i64])?;
            if let Some(row) = rows.next()? {
                let notify_i: i64 = row.get(0)?;
                Ok(notify_i != 0)
            } else {
                Ok(false)
            }
        })
        .await??;
    Ok(notify)
}

pub async fn set_notify(subject_id: u32, notify: bool) -> Result<(), AppError> {
    let pool = crate::infra::db::data_pool()?;
    let conn = pool.get().await?;
    conn.interact(move |conn| -> Result<(), rusqlite::Error> {
        conn.execute(
            "UPDATE subscriptions SET notify = ?1 WHERE subject_id = ?2",
            params![if notify { 1 } else { 0 }, subject_id as i64],
        )?;
        Ok(())
    })
    .await??;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clear_rolls_back_both_tables_on_failure() {
        let mut conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE subscriptions (subject_id INTEGER PRIMARY KEY);
             CREATE TABLE subjects_index (subject_id INTEGER PRIMARY KEY);
             INSERT INTO subscriptions VALUES (1);
             INSERT INTO subjects_index VALUES (1);
             CREATE TRIGGER fail_index_clear BEFORE DELETE ON subjects_index
             BEGIN SELECT RAISE(ABORT, 'stop'); END;",
        )
        .unwrap();

        assert!(clear_connection(&mut conn).is_err());

        let subscriptions: usize = conn
            .query_row("SELECT COUNT(*) FROM subscriptions", [], |row| row.get(0))
            .unwrap();
        let index: usize = conn
            .query_row("SELECT COUNT(*) FROM subjects_index", [], |row| row.get(0))
            .unwrap();
        assert_eq!((subscriptions, index), (1, 1));
    }
}
