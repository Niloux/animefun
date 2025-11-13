use crate::{error::CommandResult, models::bangumi::SubjectResponse, services::bangumi_service};

#[tauri::command]
pub async fn get_subject(id: u32) -> CommandResult<SubjectResponse> {
    match bangumi_service::fetch_subject(id).await {
        Ok(data) => Ok(data),
        Err(e) => Err(e.to_string()),
    }
}