use crate::{error::CommandResult, models::bangumi::SubjectResponse, services::bangumi_service};

#[tauri::command]
pub async fn get_subject(id: u32) -> CommandResult<SubjectResponse> {
    Ok(bangumi_service::fetch_subject(id).await?)
}
