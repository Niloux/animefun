use crate::{error::CommandResult, models::bangumi::SubjectView, services::bangumi_service};

#[tauri::command]
pub async fn get_subject(id: u32) -> CommandResult<SubjectView> {
    match bangumi_service::fetch_subject(id).await {
        Ok(data) => Ok(SubjectView::from(data)),
        Err(e) => Err(e.to_string()),
    }
}
