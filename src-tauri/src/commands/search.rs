use crate::{
    error::CommandResult,
    models::bangumi::SearchResponse,
    services::bangumi_service,
};

#[tauri::command]
pub async fn search_subject(
    keywords: String,
    subject_type: Option<u8>,
    limit: Option<u32>,
    offset: Option<u32>,
) -> CommandResult<SearchResponse> {
    match bangumi_service::search_subject(&keywords, subject_type, limit, offset).await {
        Ok(data) => Ok(data),
        Err(e) => Err(e.to_string()),
    }
}