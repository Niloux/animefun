use tauri::{State};
use crate::error::CommandResult;
use crate::services::downloader::service::DownloaderService;
use crate::models::download::DownloadTaskMetadata;

#[tauri::command]
pub async fn download_add(
    state: State<'_, DownloaderService>,
    anime_id: i64,
    episode_id: i64,
    magnet: String,
    save_path: String,
    metadata: DownloadTaskMetadata
) -> CommandResult<i64> {
    state.add_task(anime_id, episode_id, magnet, save_path, metadata).await
}

#[tauri::command]
pub async fn download_list(
    state: State<'_, DownloaderService>
) -> CommandResult<Vec<serde_json::Value>> {
    state.list_tasks().await
}

#[tauri::command]
pub async fn download_pause(
    state: State<'_, DownloaderService>,
    id: i64
) -> CommandResult<()> {
    state.pause_task(id).await
}

#[tauri::command]
pub async fn download_resume(
    state: State<'_, DownloaderService>,
    id: i64
) -> CommandResult<()> {
    state.resume_task(id).await
}

#[tauri::command]
pub async fn download_delete(
    state: State<'_, DownloaderService>,
    id: i64,
    delete_file: bool
) -> CommandResult<()> {
    state.delete_task(id, delete_file).await
}
