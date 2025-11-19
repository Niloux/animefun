use crate::{error::CommandResult, models::bangumi::SubjectResponse, services::bangumi_service};

#[tauri::command]
pub async fn get_subject(id: u32) -> CommandResult<SubjectResponse> {
    Ok(bangumi_service::fetch_subject(id).await?)
}

#[tauri::command]
pub async fn get_subject_status(id: u32) -> CommandResult<crate::models::bangumi::SubjectStatus> {
    Ok(bangumi_service::calc_subject_status(id).await?)
}
