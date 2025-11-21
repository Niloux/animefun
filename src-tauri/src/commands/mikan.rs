use crate::{error::CommandResult, models::mikan::MikanResourcesResponse, services::mikan_service};

#[tauri::command]
pub async fn get_mikan_resources(subject_id: u32) -> CommandResult<MikanResourcesResponse> {
    Ok(mikan_service::get_mikan_resources(subject_id).await?)
}
