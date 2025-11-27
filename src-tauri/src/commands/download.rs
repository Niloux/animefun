use crate::error::CommandResult;
use crate::models::download::DownloadTask;
use crate::models::download::DownloadTaskMetadata;
use crate::services::downloader::manager::SidecarManager;
use crate::services::downloader::service::DownloaderService;
use tauri::State;

#[tauri::command]
pub async fn download_add(
    state: State<'_, DownloaderService>,
    anime_id: i64,
    episode_id: i64,
    magnet: String,
    save_path: String,
    metadata: DownloadTaskMetadata,
) -> CommandResult<i64> {
    state
        .add_task(anime_id, episode_id, magnet, save_path, metadata)
        .await
}

#[tauri::command]
pub async fn download_list() -> CommandResult<Vec<DownloadTask>> {
    crate::services::downloader::repo::list().await
}

#[tauri::command]
pub async fn download_pause(state: State<'_, DownloaderService>, id: i64) -> CommandResult<()> {
    state.pause_task(id).await
}

#[tauri::command]
pub async fn download_resume(state: State<'_, DownloaderService>, id: i64) -> CommandResult<()> {
    state.resume_task(id).await
}

#[tauri::command]
pub async fn download_delete(
    state: State<'_, DownloaderService>,
    id: i64,
    delete_file: bool,
) -> CommandResult<()> {
    state.delete_task(id, delete_file).await
}

#[tauri::command]
pub async fn download_health(
    app: tauri::AppHandle,
    state: State<'_, DownloaderService>,
) -> CommandResult<serde_json::Value> {
    let base_dir = crate::infra::path::app_base_dir(&app).join("downloads");
    let base_dir_str = base_dir.to_string_lossy().to_string();
    let server_ok = state.health().await.unwrap_or(false);
    let sidecar_running = SidecarManager::is_running();
    Ok(serde_json::json!({
        "sidecar_running": sidecar_running,
        "server_ok": server_ok,
        "base_dir": base_dir_str,
    }))
}
