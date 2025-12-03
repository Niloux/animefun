use crate::{error::CommandResult, models::mikan::MikanResourcesResponse, services::mikan};

#[tauri::command]
pub async fn get_mikan_resources(subject_id: u32) -> CommandResult<MikanResourcesResponse> {
    mikan::get_mikan_resources(subject_id).await
}
