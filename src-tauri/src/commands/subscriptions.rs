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
    let limit = params.limit.unwrap_or(20);
    let offset = params.offset.unwrap_or(0);
    let (page_ids, total) = subscriptions::store::query(params).await?;
    let sem = Arc::new(Semaphore::new(8));
    let mut js: JoinSet<Result<SubjectResponse, crate::error::AppError>> = JoinSet::new();
    for id in page_ids.into_iter() {
        let sem_clone = Arc::clone(&sem);
        js.spawn(async move {
            let _permit = sem_clone.acquire_owned().await.ok();
            let anime = bangumi_service::fetch_subject(id).await?;
            Ok::<SubjectResponse, crate::error::AppError>(anime)
        });
    }
    let mut data: Vec<SubjectResponse> = Vec::new();
    while let Some(res) = js.join_next().await {
        if let Ok(Ok(it)) = res {
            data.push(it);
        }
    }

    Ok(crate::models::bangumi::SearchResponse {
        total,
        limit,
        offset,
        data,
    })
}
