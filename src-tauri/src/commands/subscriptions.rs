use crate::{
    error::CommandResult,
    models::bangumi::{SubjectResponse, SubjectStatusCode},
    services::subscriptions,
};
use std::time::Instant;
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
    let start = Instant::now();
    let rows = subscriptions::list_full().await?;
    let mut out: Vec<SubscriptionItem> = Vec::with_capacity(rows.len());
    for (id, added_at, notify, anime) in rows.into_iter() {
        out.push(SubscriptionItem {
            id,
            anime,
            added_at,
            notify: Some(notify),
        });
    }
    info!(count=out.len(), elapsed_ms=%start.elapsed().as_millis(), "sub_list from index");
    Ok(out)
}

#[tauri::command]
pub async fn sub_list_ids() -> CommandResult<Vec<u32>> {
    subscriptions::list_ids().await
}

#[tauri::command]
pub async fn sub_toggle(id: u32) -> CommandResult<bool> {
    subscriptions::toggle(id, None).await
}

#[tauri::command]
pub async fn sub_has(id: u32) -> CommandResult<bool> {
    subscriptions::has(id).await
}

#[tauri::command]
pub async fn sub_clear() -> CommandResult<()> {
    subscriptions::clear().await
}

#[tauri::command]
pub async fn sub_set_notify(id: u32, notify: bool) -> CommandResult<()> {
    subscriptions::set_notify(id, notify).await
}

#[tauri::command]
pub fn send_test_notification() {
    crate::infra::notification::notify_test()
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
    let (data, total) = subscriptions::query_full(params).await?;
    Ok(crate::models::bangumi::SearchResponse {
        total,
        limit,
        offset,
        data,
    })
}
