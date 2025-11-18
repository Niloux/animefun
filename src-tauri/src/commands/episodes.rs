use crate::{error::CommandResult, models::bangumi::PagedEpisode, services::bangumi_service};

#[tauri::command]
pub async fn get_episodes(
    subject_id: u32,
    ep_type: Option<u8>,
    limit: Option<u32>,
    offset: Option<u32>,
) -> CommandResult<PagedEpisode> {
    Ok(bangumi_service::fetch_episodes(subject_id, ep_type, limit, offset).await?)
}
