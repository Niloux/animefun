use crate::{
    error::CommandResult,
    models::bangumi::{SubjectResponse, SubjectStatusCode},
    services::bangumi_service,
    subscriptions,
};
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::Semaphore;
use tokio::task::JoinSet;
use tracing::info;

fn status_order(code: &SubjectStatusCode) -> u8 {
    match code {
        SubjectStatusCode::Airing => 0,
        SubjectStatusCode::PreAir => 1,
        SubjectStatusCode::Finished => 2,
        SubjectStatusCode::OnHiatus => 3,
        SubjectStatusCode::Unknown => 4,
    }
}

#[derive(serde::Serialize, ts_rs::TS)]
#[ts(export, export_to = "../../src/types/gen/bangumi.ts")]
pub struct SubscriptionItem {
    pub id: u32,
    pub anime: SubjectResponse,
    #[ts(rename = "addedAt")]
    #[ts(type = "number")]
    pub added_at: i64,
    #[ts(optional)]
    pub notify: Option<bool>,
}

#[tauri::command]
pub async fn sub_list() -> CommandResult<Vec<SubscriptionItem>> {
    let rows = subscriptions::list().await?;
    let start = Instant::now();
    let sem = Arc::new(Semaphore::new(8));
    let mut js: JoinSet<Result<SubscriptionItem, crate::error::AppError>> = JoinSet::new();
    for (id, added_at, notify) in rows.iter().cloned() {
        let sem_clone = Arc::clone(&sem);
        js.spawn(async move {
            let _permit = sem_clone.acquire_owned().await.ok();
            let anime = bangumi_service::fetch_subject(id).await?;
            Ok::<SubscriptionItem, crate::error::AppError>(SubscriptionItem {
                id,
                anime,
                added_at,
                notify: Some(notify),
            })
        });
    }
    let mut out: Vec<SubscriptionItem> = Vec::with_capacity(rows.len());
    while let Some(res) = js.join_next().await {
        match res {
            Ok(Ok(item)) => out.push(item),
            Ok(Err(_e)) => {}
            Err(_join_err) => {}
        }
    }
    out.sort_by(|a, b| b.added_at.cmp(&a.added_at));
    info!(count=out.len(), elapsed_ms=%start.elapsed().as_millis(), "sub_list fetched");
    Ok(out)
}

#[tauri::command]
pub async fn sub_list_ids() -> CommandResult<Vec<u32>> {
    Ok(subscriptions::list_ids().await?)
}

#[tauri::command]
pub async fn sub_toggle(id: u32) -> CommandResult<bool> {
    Ok(subscriptions::toggle(id, None).await?)
}

#[tauri::command]
pub async fn sub_has(id: u32) -> CommandResult<bool> {
    Ok(subscriptions::has(id).await?)
}

#[tauri::command]
pub async fn sub_clear() -> CommandResult<()> {
    Ok(subscriptions::clear().await?)
}

#[derive(serde::Serialize, serde::Deserialize, ts_rs::TS)]
#[ts(export, export_to = "../../src/types/gen/bangumi.ts")]
pub struct SubQueryParams {
    pub keywords: Option<String>,
    pub sort: Option<String>,
    pub genres: Option<Vec<String>>,
    pub min_rating: Option<f32>,
    pub max_rating: Option<f32>,
    pub status_code: Option<SubjectStatusCode>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

#[tauri::command]
pub async fn sub_query(
    params: SubQueryParams,
) -> CommandResult<crate::models::bangumi::SearchResponse> {
    let rows = subscriptions::list().await?;
    let sort_needs_status = matches!(params.sort.as_deref(), Some("status"));
    let sort_requires_all = matches!(
        params.sort.as_deref(),
        Some("rank" | "score" | "heat" | "match")
    );
    let has_text_filters = params
        .keywords
        .as_ref()
        .map(|k| !k.trim().is_empty())
        .unwrap_or(false)
        || params
            .genres
            .as_ref()
            .map(|g| !g.is_empty())
            .unwrap_or(false)
        || params.min_rating.is_some()
        || params.max_rating.is_some();
    let need_status = params.status_code.is_some() || sort_needs_status;
    let use_prefilter = need_status && !(has_text_filters || sort_requires_all);

    let mut base_ids: Vec<u32> = rows.iter().map(|(id, _, _)| *id).collect();
    let mut status_map: std::collections::HashMap<u32, SubjectStatusCode> =
        std::collections::HashMap::new();

    if use_prefilter {
        let sem = Arc::new(Semaphore::new(8));
        let mut js: JoinSet<
            Result<(u32, crate::models::bangumi::SubjectStatus), crate::error::AppError>,
        > = JoinSet::new();
        for id in base_ids.iter().cloned() {
            let sem_clone = Arc::clone(&sem);
            js.spawn(async move {
                let _permit = sem_clone.acquire_owned().await.ok();
                let st = subscriptions::get_status_cached(id).await?;
                Ok::<(u32, crate::models::bangumi::SubjectStatus), crate::error::AppError>((id, st))
            });
        }
        base_ids.clear();
        while let Some(res) = js.join_next().await {
            if let Ok(Ok((id, st))) = res {
                if let Some(code) = params.status_code.as_ref() {
                    if &st.code != code {
                        continue;
                    }
                }
                status_map.insert(id, st.code);
                base_ids.push(id);
            }
        }
        if sort_needs_status {
            base_ids.sort_by(|a, b| {
                let oa = status_map.get(a).map(|c| status_order(c)).unwrap_or(5);
                let ob = status_map.get(b).map(|c| status_order(c)).unwrap_or(5);
                oa.cmp(&ob)
            });
        }
    }

    let limit = params.limit.unwrap_or(20);
    let offset = params.offset.unwrap_or(0);
    let total_ids = base_ids.len() as u32;
    let page_ids: Vec<u32> = if (offset as usize) >= base_ids.len() {
        Vec::new()
    } else {
        base_ids
            .into_iter()
            .skip(offset as usize)
            .take(limit as usize)
            .collect()
    };

    let mut items: Vec<(
        SubjectResponse,
        Option<crate::models::bangumi::SubjectStatus>,
    )> = Vec::new();
    if use_prefilter {
        let sem = Arc::new(Semaphore::new(8));
        let mut js: JoinSet<
            Result<
                (
                    SubjectResponse,
                    Option<crate::models::bangumi::SubjectStatus>,
                ),
                crate::error::AppError,
            >,
        > = JoinSet::new();
        for id in page_ids.into_iter() {
            let sem_clone = Arc::clone(&sem);
            js.spawn(async move {
                let _permit = sem_clone.acquire_owned().await.ok();
                let anime = bangumi_service::fetch_subject(id).await?;
                Ok::<
                    (
                        SubjectResponse,
                        Option<crate::models::bangumi::SubjectStatus>,
                    ),
                    crate::error::AppError,
                >((anime, None))
            });
        }
        while let Some(res) = js.join_next().await {
            if let Ok(Ok(it)) = res {
                items.push(it);
            }
        }
    } else {
        let sem = Arc::new(Semaphore::new(8));
        let mut js: JoinSet<
            Result<
                (
                    SubjectResponse,
                    Option<crate::models::bangumi::SubjectStatus>,
                ),
                crate::error::AppError,
            >,
        > = JoinSet::new();
        for (id, _added_at, _notify) in rows.iter().cloned() {
            let sem_clone = Arc::clone(&sem);
            js.spawn(async move {
                let _permit = sem_clone.acquire_owned().await.ok();
                let anime = bangumi_service::fetch_subject(id).await?;
                let status = if need_status {
                    Some(subscriptions::get_status_cached(id).await?)
                } else {
                    None
                };
                Ok::<
                    (
                        SubjectResponse,
                        Option<crate::models::bangumi::SubjectStatus>,
                    ),
                    crate::error::AppError,
                >((anime, status))
            });
        }
        while let Some(res) = js.join_next().await {
            if let Ok(Ok(it)) = res {
                items.push(it);
            }
        }
    }
    let mut filtered_items: Vec<(
        SubjectResponse,
        Option<crate::models::bangumi::SubjectStatus>,
    )> = items
        .into_iter()
        .filter(|(a, st)| {
            if let Some(k) = params.keywords.as_ref() {
                let q = k.trim().to_lowercase();
                if !q.is_empty() {
                    let n1 = a.name.to_lowercase();
                    let n2 = a.name_cn.to_lowercase();
                    if !n1.contains(&q) && !n2.contains(&q) {
                        return false;
                    }
                }
            }
            if let Some(gs) = params.genres.as_ref() {
                if !gs.is_empty() {
                    let mut tags: Vec<String> = Vec::new();
                    if let Some(t) = a.meta_tags.as_ref() {
                        tags.extend(t.iter().cloned());
                    }
                    if let Some(t) = a.tags.as_ref() {
                        tags.extend(t.iter().map(|x| x.name.clone()));
                    }
                    let set: std::collections::HashSet<String> =
                        tags.into_iter().map(|x| x.to_lowercase()).collect();
                    for g in gs {
                        if !set.contains(&g.to_lowercase()) {
                            return false;
                        }
                    }
                }
            }
            if let Some(minr) = params.min_rating {
                if let Some(r) = a.rating.as_ref() {
                    if r.score < minr {
                        return false;
                    }
                } else {
                    return false;
                }
            }
            if let Some(maxr) = params.max_rating {
                if let Some(r) = a.rating.as_ref() {
                    if r.score > maxr {
                        return false;
                    }
                }
            }
            if let Some(code) = params.status_code.as_ref() {
                if let Some(s) = st.as_ref() {
                    if &s.code != code {
                        return false;
                    }
                } else {
                    return false;
                }
            }
            true
        })
        .collect();

    match params.sort.as_deref() {
        Some("status") => {
            filtered_items.sort_by(|(_, sa), (_, sb)| {
                let oa = sa.as_ref().map(|s| status_order(&s.code)).unwrap_or(5);
                let ob = sb.as_ref().map(|s| status_order(&s.code)).unwrap_or(5);
                oa.cmp(&ob)
            });
        }
        Some("rank") => {
            filtered_items.sort_by(|(a, _), (b, _)| {
                let ar = a.rating.as_ref().and_then(|r| r.rank).unwrap_or(u32::MAX);
                let br = b.rating.as_ref().and_then(|r| r.rank).unwrap_or(u32::MAX);
                ar.cmp(&br)
            });
        }
        Some("score") => {
            filtered_items.sort_by(|(a, _), (b, _)| {
                let ascore = a.rating.as_ref().map(|r| r.score).unwrap_or(0.0);
                let bscore = b.rating.as_ref().map(|r| r.score).unwrap_or(0.0);
                bscore
                    .partial_cmp(&ascore)
                    .unwrap_or(std::cmp::Ordering::Equal)
            });
        }
        Some("heat") => {
            filtered_items.sort_by(|(a, _), (b, _)| {
                let atotal = a.rating.as_ref().map(|r| r.total).unwrap_or(0);
                let btotal = b.rating.as_ref().map(|r| r.total).unwrap_or(0);
                btotal.cmp(&atotal)
            });
        }
        Some("match") => {
            if let Some(k) = params.keywords.as_ref() {
                let q = k.trim().to_lowercase();
                filtered_items.sort_by(|(a, _), (b, _)| {
                    let n1 = a.name.to_lowercase();
                    let n2 = a.name_cn.to_lowercase();
                    let m_a = if n1.contains(&q) {
                        2
                    } else if n2.contains(&q) {
                        1
                    } else {
                        0
                    };
                    let n1b = b.name.to_lowercase();
                    let n2b = b.name_cn.to_lowercase();
                    let m_b = if n1b.contains(&q) {
                        2
                    } else if n2b.contains(&q) {
                        1
                    } else {
                        0
                    };
                    m_b.cmp(&m_a)
                });
            }
        }
        _ => {}
    }

    let total = if use_prefilter {
        total_ids
    } else {
        filtered_items.len() as u32
    };
    let data: Vec<SubjectResponse> = if use_prefilter {
        filtered_items.into_iter().map(|(a, _)| a).collect()
    } else {
        let start = offset as usize;
        if start >= filtered_items.len() {
            Vec::new()
        } else {
            filtered_items
                .into_iter()
                .skip(start)
                .take(limit as usize)
                .map(|(a, _)| a)
                .collect()
        }
    };

    Ok(crate::models::bangumi::SearchResponse {
        total,
        limit,
        offset,
        data,
    })
}
