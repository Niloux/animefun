use rusqlite::{params, Connection};
use std::path::PathBuf;

use crate::error::AppError;
use crate::infra::time::now_secs;
use crate::models::bangumi::{SubjectResponse, SubjectStatusCode};
use crate::services::bangumi_service;
use crate::subscriptions;
use tracing::{debug, info};

static SUBS_DB_FILE: once_cell::sync::OnceCell<PathBuf> = once_cell::sync::OnceCell::new();

pub fn init(base_dir: PathBuf) -> Result<(), AppError> {
    std::fs::create_dir_all(&base_dir)?;
    let file = base_dir.join("data.sqlite");
    SUBS_DB_FILE.set(file.clone()).ok();
    crate::infra::db::init_data_db(base_dir)?;
    Ok(())
}

fn ensure_table(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS subscriptions (
            subject_id INTEGER PRIMARY KEY,
            added_at   INTEGER NOT NULL,
            notify     INTEGER NOT NULL DEFAULT 0
        )",
        [],
    )?;
    conn.execute(
        "CREATE TABLE IF NOT EXISTS subjects_index (
            subject_id    INTEGER PRIMARY KEY,
            added_at      INTEGER NOT NULL DEFAULT 0,
            updated_at    INTEGER NOT NULL,
            name          TEXT    NOT NULL,
            name_cn       TEXT    NOT NULL,
            tags_csv      TEXT    NOT NULL DEFAULT '',
            meta_tags_csv TEXT    NOT NULL DEFAULT '',
            rating_score  REAL,
            rating_rank   INTEGER,
            rating_total  INTEGER,
            status_code   INTEGER NOT NULL,
            status_ord    INTEGER NOT NULL
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

pub async fn toggle(id: u32, notify: Option<bool>) -> Result<bool, AppError> {
    let now = now_secs();
    let pool = crate::infra::db::data_pool()?;
    let conn = pool.get().await?;
    let res = conn
        .interact(move |conn| -> Result<bool, rusqlite::Error> {
            ensure_table(conn)?;
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
                let notify_i = if notify.unwrap_or(false) { 1 } else { 0 };
                conn.execute(
                    "INSERT INTO subscriptions(subject_id, added_at, notify) VALUES(?1, ?2, ?3)",
                    params![id as i64, now, notify_i],
                )?;
                info!(id, notify=%(notify.unwrap_or(false)), "subscribe");
                Ok(true)
            }
        })
        .await??;

    if res {
        tauri::async_runtime::spawn(async move {
            let subject = match bangumi_service::fetch_subject(id).await {
                Ok(s) => s,
                Err(_) => return,
            };
            let status = match subscriptions::get_status_cached(id).await {
                Ok(s) => s.code,
                Err(_) => SubjectStatusCode::Unknown,
            };
            let _ = upsert_index_row(id, now, subject, status).await;
        });
    } else {
        tauri::async_runtime::spawn(async move {
            let _ = delete_index_row(id).await;
        });
    }

    Ok(res)
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

fn status_ord(code: &SubjectStatusCode) -> i64 {
    match code {
        SubjectStatusCode::Airing => 0,
        SubjectStatusCode::PreAir => 1,
        SubjectStatusCode::Finished => 2,
        SubjectStatusCode::OnHiatus => 3,
        SubjectStatusCode::Unknown => 4,
    }
}

fn build_tags_csv(subject: &SubjectResponse) -> String {
    let mut tags: Vec<String> = Vec::new();
    if let Some(t) = subject.meta_tags.as_ref() {
        for s in t.iter() {
            let k = s.trim().to_lowercase();
            if !k.is_empty() {
                tags.push(k);
            }
        }
    }
    if let Some(t) = subject.tags.as_ref() {
        for x in t.iter() {
            let k = x.name.trim().to_lowercase();
            if !k.is_empty() {
                tags.push(k);
            }
        }
    }
    tags.sort();
    tags.dedup();
    let mut csv = String::from(",");
    for (i, k) in tags.iter().enumerate() {
        if i > 0 {
            csv.push(',');
        }
        csv.push_str(k);
    }
    csv.push(',');
    csv
}

pub async fn upsert_index_row(
    id: u32,
    added_at: i64,
    subject: SubjectResponse,
    status: SubjectStatusCode,
) -> Result<(), AppError> {
    let pool = crate::infra::db::data_pool()?;
    let conn = pool.get().await?;
    conn
        .interact(move |conn| -> Result<(), rusqlite::Error> {
            ensure_table(conn)?;
            let name = subject.name.clone();
            let name_cn = subject.name_cn.clone();
            let tags_csv = build_tags_csv(&subject);
            let meta_tags_csv = String::new();
            let rating_score: Option<f32> = subject.rating.as_ref().map(|r| r.score);
            let rating_rank: Option<i64> = subject.rating.as_ref().and_then(|r| r.rank.map(|x| x as i64));
            let rating_total: Option<i64> = subject.rating.as_ref().map(|r| r.total as i64);
            let status_ord_v = status_ord(&status);
            let status_code = status_ord_v;
            let updated_at = now_secs();
            conn.execute(
                "INSERT INTO subjects_index(subject_id, added_at, updated_at, name, name_cn, tags_csv, meta_tags_csv, rating_score, rating_rank, rating_total, status_code, status_ord)
                 VALUES(?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
                 ON CONFLICT(subject_id) DO UPDATE SET
                    added_at=excluded.added_at,
                    updated_at=excluded.updated_at,
                    name=excluded.name,
                    name_cn=excluded.name_cn,
                    tags_csv=excluded.tags_csv,
                    meta_tags_csv=excluded.meta_tags_csv,
                    rating_score=excluded.rating_score,
                    rating_rank=excluded.rating_rank,
                    rating_total=excluded.rating_total,
                    status_code=excluded.status_code,
                    status_ord=excluded.status_ord",
                params![
                    id as i64,
                    added_at,
                    updated_at,
                    name,
                    name_cn,
                    tags_csv,
                    meta_tags_csv,
                    rating_score,
                    rating_rank,
                    rating_total,
                    status_code,
                    status_ord_v,
                ],
            )?;
            Ok(())
        })
        .await??;
    Ok(())
}

pub async fn upsert_index_row_if_changed(
    id: u32,
    added_at: i64,
    subject: SubjectResponse,
    status: SubjectStatusCode,
) -> Result<bool, AppError> {
    let name = subject.name.clone();
    let name_cn = subject.name_cn.clone();
    let tags_csv = build_tags_csv(&subject);
    let meta_tags_csv = String::new();
    let rating_score: Option<f32> = subject.rating.as_ref().map(|r| r.score);
    let rating_rank: Option<i64> = subject
        .rating
        .as_ref()
        .and_then(|r| r.rank.map(|x| x as i64));
    let rating_total: Option<i64> = subject.rating.as_ref().map(|r| r.total as i64);
    let status_ord_v = status_ord(&status);
    let status_code = status_ord_v;

    let pool = crate::infra::db::data_pool()?;
    let conn = pool.get().await?;
    let need_update = conn
        .interact(move |conn| -> Result<bool, rusqlite::Error> {
            ensure_table(conn)?;
            let mut stmt = conn.prepare(
                "SELECT name, name_cn, tags_csv, meta_tags_csv, rating_score, rating_rank, rating_total, status_code, status_ord FROM subjects_index WHERE subject_id = ?1",
            )?;
            let mut rows = stmt.query(params![id as i64])?;
            if let Some(row) = rows.next()? {
                let cur_name: String = row.get(0)?;
                let cur_name_cn: String = row.get(1)?;
                let cur_tags_csv: String = row.get(2)?;
                let cur_meta_tags_csv: String = row.get(3)?;
                let cur_rating_score: Option<f32> = row.get(4)?;
                let cur_rating_rank: Option<i64> = row.get(5)?;
                let cur_rating_total: Option<i64> = row.get(6)?;
                let cur_status_code: i64 = row.get(7)?;
                let cur_status_ord: i64 = row.get(8)?;
                Ok(!(cur_name == name
                    && cur_name_cn == name_cn
                    && cur_tags_csv == tags_csv
                    && cur_meta_tags_csv == meta_tags_csv
                    && cur_rating_score == rating_score
                    && cur_rating_rank == rating_rank
                    && cur_rating_total == rating_total
                    && cur_status_code == status_code
                    && cur_status_ord == status_ord_v))
            } else {
                Ok(true)
            }
        })
        .await??;
    if need_update {
        debug!("索引 {} 已变更", id);
        upsert_index_row(id, added_at, subject, status).await?;
        Ok(true)
    } else {
        debug!("索引 {} 未变更", id);
        Ok(false)
    }
}

pub async fn query(
    params: crate::commands::subscriptions::SubQueryParams,
) -> Result<(Vec<u32>, u32), AppError> {
    let pool = crate::infra::db::data_pool()?;
    let conn = pool.get().await?;
    let (ids, total) = conn
        .interact(move |conn| -> Result<(Vec<u32>, u32), rusqlite::Error> {
            ensure_table(conn)?;
            let mut sql_where = String::new();
            let mut binds: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();
            if let Some(k) = params.keywords.as_ref() {
                let q = k.trim().to_lowercase();
                if !q.is_empty() {
                    sql_where.push_str(" AND (LOWER(name) LIKE ? OR LOWER(name_cn) LIKE ?)");
                    binds.push(Box::new(format!("%{}%", q)));
                    binds.push(Box::new(format!("%{}%", q)));
                }
            }
            if let Some(gs) = params.genres.as_ref() {
                for g in gs.iter() {
                    let v = g.trim().to_lowercase();
                    if !v.is_empty() {
                        sql_where.push_str(" AND (tags_csv LIKE ?)");
                        binds.push(Box::new(format!("%,{},%", v)));
                    }
                }
            }
            if let Some(minr) = params.min_rating.as_ref() {
                sql_where.push_str(" AND (rating_score IS NOT NULL AND rating_score >= ?)");
                binds.push(Box::new(*minr));
            }
            if let Some(maxr) = params.max_rating.as_ref() {
                sql_where.push_str(" AND (rating_score IS NOT NULL AND rating_score <= ?)");
                binds.push(Box::new(*maxr));
            }
            if let Some(code) = params.status_code.as_ref() {
                sql_where.push_str(" AND status_code = ?");
                let cval: i64 = status_ord(code) as i64;
                binds.push(Box::new(cval));
            }
            let order_by = match params.sort.as_deref() {
                Some("status") => " ORDER BY status_ord ASC".to_string(),
                Some("rank") => " ORDER BY (rating_rank IS NULL) ASC, rating_rank ASC".to_string(),
                Some("score") => " ORDER BY COALESCE(rating_score, 0) DESC".to_string(),
                Some("heat") => " ORDER BY COALESCE(rating_total, 0) DESC".to_string(),
                Some("match") => {
                    if let Some(k) = params.keywords.as_ref() {
                        let q = k.trim().to_lowercase();
                        if !q.is_empty() {
                            sql_where.push_str(" AND (LOWER(name) LIKE ? OR LOWER(name_cn) LIKE ?)");
                            binds.push(Box::new(format!("%{}%", q)));
                            binds.push(Box::new(format!("%{}%", q)));
                            " ORDER BY CASE WHEN LOWER(name) LIKE ? THEN 2 WHEN LOWER(name_cn) LIKE ? THEN 1 ELSE 0 END DESC".to_string()
                        } else { String::new() }
                    } else { String::new() }
                }
                _ => " ORDER BY added_at DESC".to_string(),
            };

            let limit = params.limit.unwrap_or(20) as i64;
            let offset = params.offset.unwrap_or(0) as i64;

            // total count
            let count_sql = format!("SELECT COUNT(*) FROM subjects_index WHERE 1=1{}", sql_where);
            let mut count_stmt = conn.prepare(&count_sql)?;
            let total: u32 = {
                let mut bind_refs: Vec<&dyn rusqlite::ToSql> = Vec::new();
                for b in binds.iter() { bind_refs.push(&**b); }
                let mut rows = count_stmt.query(rusqlite::params_from_iter(bind_refs.iter().copied()))?;
                let cnt: u32 = if let Some(row) = rows.next()? { row.get::<_, i64>(0)? as u32 } else { 0 };
                cnt
            };

            // ids page
            let page_sql = format!("SELECT subject_id FROM subjects_index WHERE 1=1{}{} LIMIT ? OFFSET ?", sql_where, order_by);
            let mut page_stmt = conn.prepare(&page_sql)?;
            let mut bind_refs: Vec<&dyn rusqlite::ToSql> = Vec::new();
            for b in binds.iter() { bind_refs.push(&**b); }
            bind_refs.push(&limit);
            bind_refs.push(&offset);
            let mut rows = page_stmt.query(rusqlite::params_from_iter(bind_refs.iter().copied()))?;
            let mut out: Vec<u32> = Vec::new();
            while let Some(row) = rows.next()? {
                let id: u32 = row.get::<_, i64>(0)? as u32;
                out.push(id);
            }
            Ok((out, total))
        })
        .await??;
    Ok((ids, total))
}

pub async fn delete_index_row(id: u32) -> Result<(), AppError> {
    let pool = crate::infra::db::data_pool()?;
    let conn = pool.get().await?;
    conn.interact(move |conn| -> Result<(), rusqlite::Error> {
        ensure_table(conn)?;
        conn.execute(
            "DELETE FROM subjects_index WHERE subject_id = ?1",
            params![id as i64],
        )?;
        Ok(())
    })
    .await??;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::infra::path::default_app_dir;

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
