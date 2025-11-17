use crate::{
    error::CommandResult,
    models::bangumi::SearchResponse,
    services::bangumi_service,
};

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
    match bangumi_service::search_subject(&keywords, subject_type, sort, tag, air_date, rating, rating_count, rank, nsfw, limit, offset).await {
        Ok(data) => Ok(data),
        Err(e) => Err(e.to_string()),
    }
}