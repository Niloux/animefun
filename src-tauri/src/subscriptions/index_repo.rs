use rusqlite::{params, Connection};

use crate::error::AppError;
use crate::infra::time::now_secs;
use crate::models::bangumi::{Images, SubjectRating, SubjectResponse, SubjectStatusCode};

fn ensure_table(conn: &Connection) -> Result<(), rusqlite::Error> {
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
            status_ord    INTEGER NOT NULL,
            cover_url     TEXT    NOT NULL DEFAULT ''
        )",
        [],
    )?;
    let _ = conn.execute(
        "ALTER TABLE subjects_index ADD COLUMN cover_url TEXT NOT NULL DEFAULT ''",
        [],
    );
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

pub async fn index_upsert(
    id: u32,
    added_at: i64,
    subject: SubjectResponse,
    status: SubjectStatusCode,
) -> Result<(), AppError> {
    let _ = index_upsert_rows(id, added_at, subject, status).await?;
    Ok(())
}

pub async fn index_upsert_if_changed(
    id: u32,
    added_at: i64,
    subject: SubjectResponse,
    status: SubjectStatusCode,
) -> Result<bool, AppError> {
    let n = index_upsert_rows(id, added_at, subject, status).await?;
    Ok(n > 0)
}

async fn index_upsert_rows(
    id: u32,
    added_at: i64,
    subject: SubjectResponse,
    status: SubjectStatusCode,
) -> Result<usize, AppError> {
    let pool = crate::infra::db::data_pool()?;
    let conn = pool.get().await?;
    let n = conn
        .interact(move |conn| -> Result<usize, rusqlite::Error> {
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
            let cover_url = subject.images.large.clone();
            let n = conn.execute(
                "INSERT INTO subjects_index(subject_id, added_at, updated_at, name, name_cn, tags_csv, meta_tags_csv, rating_score, rating_rank, rating_total, status_code, status_ord, cover_url)
                 VALUES(?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
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
                    status_ord=excluded.status_ord,
                    cover_url=excluded.cover_url
                 WHERE name <> excluded.name
                    OR name_cn <> excluded.name_cn
                    OR tags_csv <> excluded.tags_csv
                    OR meta_tags_csv <> excluded.meta_tags_csv
                    OR rating_score IS NOT excluded.rating_score
                    OR rating_rank IS NOT excluded.rating_rank
                    OR rating_total IS NOT excluded.rating_total
                    OR status_code <> excluded.status_code
                    OR status_ord <> excluded.status_ord
                    OR cover_url <> excluded.cover_url",
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
                    cover_url,
                ],
            )?;
            Ok(n)
        })
        .await??;
    Ok(n)
}

pub async fn index_delete(id: u32) -> Result<(), AppError> {
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

pub async fn index_clear() -> Result<(), AppError> {
    let pool = crate::infra::db::data_pool()?;
    let conn = pool.get().await?;
    conn.interact(|conn| -> Result<(), rusqlite::Error> {
        ensure_table(conn)?;
        conn.execute("DELETE FROM subjects_index", [])?;
        Ok(())
    })
    .await??;
    Ok(())
}

fn make_subject_from_index(
    id: u32,
    name: String,
    name_cn: String,
    cover_url: String,
    rating_score: Option<f32>,
    rating_rank: Option<i64>,
    rating_total: Option<i64>,
) -> SubjectResponse {
    let img = Images {
        large: cover_url.clone(),
        common: cover_url.clone(),
        medium: cover_url.clone(),
        small: cover_url.clone(),
        grid: cover_url,
    };
    let rating = match (rating_rank, rating_total, rating_score) {
        (rank_opt, Some(total), Some(score)) => Some(SubjectRating {
            rank: rank_opt.map(|v| v as u32),
            total: total as u32,
            count: std::collections::HashMap::new(),
            score,
        }),
        _ => None,
    };
    SubjectResponse {
        id,
        url: None,
        item_type: 2,
        name,
        name_cn,
        summary: String::new(),
        series: None,
        nsfw: false,
        locked: false,
        date: None,
        platform: None,
        images: img,
        infobox: None,
        volumes: None,
        eps: None,
        total_episodes: None,
        rating,
        collection: None,
        meta_tags: None,
        tags: None,
    }
}

pub async fn query_full(
    params: crate::commands::subscriptions::SubQueryParams,
) -> Result<(Vec<SubjectResponse>, u32), AppError> {
    let pool = crate::infra::db::data_pool()?;
    let conn = pool.get().await?;
    let (items, total) = conn
        .interact(move |conn| -> Result<(Vec<SubjectResponse>, u32), rusqlite::Error> {
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

            let count_sql = format!("SELECT COUNT(*) FROM subjects_index WHERE 1=1{}", sql_where);
            let mut count_stmt = conn.prepare(&count_sql)?;
            let total: u32 = {
                let mut bind_refs: Vec<&dyn rusqlite::ToSql> = Vec::new();
                for b in binds.iter() { bind_refs.push(&**b); }
                let mut rows = count_stmt.query(rusqlite::params_from_iter(bind_refs.iter().copied()))?;
                let cnt: u32 = if let Some(row) = rows.next()? { row.get::<_, i64>(0)? as u32 } else { 0 };
                cnt
            };

            let page_sql = format!(
                "SELECT subject_id, name, name_cn, rating_score, rating_rank, rating_total, cover_url FROM subjects_index WHERE 1=1{}{} LIMIT ? OFFSET ?",
                sql_where,
                order_by,
            );
            let mut page_stmt = conn.prepare(&page_sql)?;
            let mut bind_refs: Vec<&dyn rusqlite::ToSql> = Vec::new();
            for b in binds.iter() { bind_refs.push(&**b); }
            bind_refs.push(&limit);
            bind_refs.push(&offset);
            let mut rows = page_stmt.query(rusqlite::params_from_iter(bind_refs.iter().copied()))?;
            let mut out: Vec<SubjectResponse> = Vec::new();
            while let Some(row) = rows.next()? {
                let id: u32 = row.get::<_, i64>(0)? as u32;
                let name: String = row.get(1)?;
                let name_cn: String = row.get(2)?;
                let rating_score: Option<f32> = row.get(3)?;
                let rating_rank: Option<i64> = row.get(4)?;
                let rating_total: Option<i64> = row.get(5)?;
                let cover_url: String = row.get(6)?;
                let subject = make_subject_from_index(
                    id,
                    name,
                    name_cn,
                    cover_url,
                    rating_score,
                    rating_rank,
                    rating_total,
                );
                out.push(subject);
            }
            Ok((out, total))
        })
        .await??;
    Ok((items, total))
}

pub async fn list_full() -> Result<Vec<(u32, i64, bool, SubjectResponse)>, AppError> {
    let pool = crate::infra::db::data_pool()?;
    let conn = pool.get().await?;
    let rows = conn
        .interact(|conn| -> Result<Vec<(u32, i64, bool, SubjectResponse)>, rusqlite::Error> {
            ensure_table(conn)?;
            let mut stmt = conn.prepare(
                "SELECT s.subject_id, s.added_at, s.notify, i.name, i.name_cn, i.rating_score, i.rating_rank, i.rating_total, i.cover_url
                 FROM subscriptions s
                 LEFT JOIN subjects_index i ON i.subject_id = s.subject_id
                 ORDER BY s.added_at DESC",
            )?;
            let mut rows = stmt.query([])?;
            let mut out: Vec<(u32, i64, bool, SubjectResponse)> = Vec::new();
            while let Some(row) = rows.next()? {
                let id: u32 = row.get::<_, i64>(0)? as u32;
                let added_at: i64 = row.get(1)?;
                let notify_i: i64 = row.get(2)?;
                let name: String = row.get(3)?;
                let name_cn: String = row.get(4)?;
                let rating_score: Option<f32> = row.get(5)?;
                let rating_rank: Option<i64> = row.get(6)?;
                let rating_total: Option<i64> = row.get(7)?;
                let cover_url: String = row.get(8)?;
                let subject = make_subject_from_index(
                    id,
                    name,
                    name_cn,
                    cover_url,
                    rating_score,
                    rating_rank,
                    rating_total,
                );
                out.push((id, added_at, notify_i != 0, subject));
            }
            Ok(out)
        })
        .await??;
    Ok(rows)
}
