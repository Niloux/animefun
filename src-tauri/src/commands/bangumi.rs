use crate::{
    error::CommandResult, models::bangumi::PagedEpisode, models::bangumi::SearchResponse,
    models::bangumi::SubjectResponse, services::bangumi_service,
};

#[tauri::command]
pub async fn get_calendar() -> CommandResult<Vec<crate::models::bangumi::CalendarResponse>> {
    Ok(bangumi_service::fetch_calendar().await?)
}

#[tauri::command]
pub async fn get_episodes(
    subject_id: u32,
    ep_type: Option<u8>,
    limit: Option<u32>,
    offset: Option<u32>,
) -> CommandResult<PagedEpisode> {
    Ok(bangumi_service::fetch_episodes(subject_id, ep_type, limit, offset).await?)
}

#[tauri::command]
pub async fn get_subject(id: u32) -> CommandResult<SubjectResponse> {
    Ok(bangumi_service::fetch_subject(id).await?)
}

#[tauri::command]
pub async fn get_subject_status(id: u32) -> CommandResult<crate::models::bangumi::SubjectStatus> {
    Ok(bangumi_service::calc_subject_status(id).await?)
}

#[tauri::command]
pub async fn search_subject(
    keywords: String,
    subject_type: Option<Vec<u8>>,
    sort: Option<String>,
    tag: Option<Vec<String>>,
    air_date: Option<Vec<String>>,
    rating: Option<Vec<String>>,
    rating_count: Option<Vec<String>>,
    rank: Option<Vec<String>>,
    nsfw: Option<bool>,
    limit: Option<u32>,
    offset: Option<u32>,
) -> CommandResult<SearchResponse> {
    Ok(bangumi_service::search_subject(
        &keywords,
        subject_type,
        sort,
        tag,
        air_date,
        rating,
        rating_count,
        rank,
        nsfw,
        limit,
        offset,
    )
    .await?)
}
