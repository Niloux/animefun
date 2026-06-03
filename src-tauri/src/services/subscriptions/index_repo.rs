use rusqlite::{params, ToSql};

use crate::error::AppError;
use crate::infra::time::now_secs;
use crate::models::bangumi::{Images, SubjectRating, SubjectResponse, SubjectStatusCode};
use crate::services::subscriptions::query::{self, QueryBind, SubscriptionQuery};
use std::collections::HashMap;

fn status_ord(code: &SubjectStatusCode) -> i64 {
    query::status_ord(code)
}

fn build_tags_csv(subject: &SubjectResponse) -> String {
    let mut tags: Vec<String> = Vec::new();

    // 处理 meta_tags
    if let Some(meta_tags) = &subject.meta_tags {
        tags.extend(
            meta_tags
                .iter()
                .map(|s| s.trim().to_lowercase())
                .filter(|s| !s.is_empty()),
        );
    }

    // 处理 tags
    if let Some(api_tags) = &subject.tags {
        tags.extend(
            api_tags
                .iter()
                .map(|tag| tag.name.trim().to_lowercase())
                .filter(|s| !s.is_empty()),
        );
    }

    tags.sort();
    tags.dedup();

    format!(",{tags},", tags = tags.join(","))
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

pub async fn query_full(query: SubscriptionQuery) -> Result<(Vec<SubjectResponse>, u32), AppError> {
    let pool = crate::infra::db::data_pool()?;
    let conn = pool.get().await?;
    let (items, total) = conn
        .interact(move |conn| -> Result<(Vec<SubjectResponse>, u32), rusqlite::Error> {
            let plan = query::build_query_plan(&query);

            let count_sql = format!(
                "SELECT COUNT(*) FROM subjects_index WHERE 1=1{}",
                plan.where_sql
            );
            let mut count_stmt = conn.prepare(&count_sql)?;
            let total: u32 = {
                let filter_bind_refs = bind_refs(&plan.filter_binds);
                let mut rows =
                    count_stmt.query(rusqlite::params_from_iter(filter_bind_refs.iter().copied()))?;
                if let Some(row) = rows.next()? {
                    row.get::<_, i64>(0)? as u32
                } else {
                    0
                }
            };

            let page_sql = format!(
                "SELECT subject_id, name, name_cn, rating_score, rating_rank, rating_total, cover_url FROM subjects_index WHERE 1=1{}{} LIMIT ? OFFSET ?",
                plan.where_sql,
                plan.order_sql,
            );
            let mut page_stmt = conn.prepare(&page_sql)?;
            let mut page_bind_refs = bind_refs(&plan.filter_binds);
            page_bind_refs.extend(bind_refs(&plan.order_binds));
            page_bind_refs.push(&plan.limit);
            page_bind_refs.push(&plan.offset);
            let mut rows =
                page_stmt.query(rusqlite::params_from_iter(page_bind_refs.iter().copied()))?;
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

fn bind_refs(binds: &[QueryBind]) -> Vec<&dyn ToSql> {
    binds
        .iter()
        .map(|bind| match bind {
            QueryBind::Integer(value) => value as &dyn ToSql,
            QueryBind::Real(value) => value as &dyn ToSql,
            QueryBind::Text(value) => value as &dyn ToSql,
        })
        .collect()
}

pub async fn list_full() -> Result<Vec<(u32, i64, bool, SubjectResponse)>, AppError> {
    let pool = crate::infra::db::data_pool()?;
    let conn = pool.get().await?;
    let rows = conn
        .interact(|conn| -> Result<Vec<(u32, i64, bool, SubjectResponse)>, rusqlite::Error> {
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

pub struct SubjectMetadata {
    pub subject_id: u32,
    pub name: String,
    pub name_cn: String,
    pub cover_url: String,
}

pub async fn batch_get_metadata(
    subject_ids: &[u32],
) -> Result<HashMap<u32, SubjectMetadata>, AppError> {
    if subject_ids.is_empty() {
        return Ok(HashMap::new());
    }

    let pool = crate::infra::db::data_pool()?;
    let conn = pool.get().await?;

    const MAX_IN_BATCH: usize = 500;

    // Split into chunks to avoid hitting SQLite expression limits
    let mut result: HashMap<u32, SubjectMetadata> = HashMap::new();

    for chunk in subject_ids.chunks(MAX_IN_BATCH) {
        let ids: Vec<i64> = chunk.iter().map(|&id| id as i64).collect();

        let chunk_metadata = conn.interact(move |conn| -> Result<HashMap<u32, SubjectMetadata>, rusqlite::Error> {
            // Build IN clause with exact number of placeholders (safe: ids are i64, controlled input)
            let placeholders = ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
            let sql = format!(
                "SELECT subject_id, name, name_cn, cover_url FROM subjects_index WHERE subject_id IN ({})",
                placeholders
            );
            let mut stmt = conn.prepare(&sql)?;
            let mut rows = stmt.query(rusqlite::params_from_iter(ids.iter()))?;
            let mut metadata: HashMap<u32, SubjectMetadata> = HashMap::new();

            while let Some(row) = rows.next()? {
                let id: u32 = row.get::<_, i64>(0)? as u32;
                let name: String = row.get(1)?;
                let name_cn: String = row.get(2)?;
                let cover_url: String = row.get(3)?;

                metadata.insert(
                    id,
                    SubjectMetadata {
                        subject_id: id,
                        name,
                        name_cn,
                        cover_url,
                    },
                );
            }

            Ok(metadata)
        })
        .await??;

        result.extend(chunk_metadata);
    }

    Ok(result)
}
