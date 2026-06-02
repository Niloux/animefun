use crate::error::{AppError, CommandResult};
use crate::services::downloader::{client, config, lifecycle, DownloadItem};

use tauri_plugin_opener::OpenerExt;

#[tauri::command]
pub async fn get_downloader_config() -> CommandResult<config::DownloaderConfig> {
    config::get_config().await
}

#[tauri::command]
pub async fn set_downloader_config(config: config::DownloaderConfig) -> CommandResult<()> {
    config::save_config(config).await
}

#[tauri::command]
pub async fn test_downloader_connection() -> CommandResult<String> {
    lifecycle::test_connection().await
}

#[tauri::command]
pub async fn add_torrent_and_track(
    url: String,
    subject_id: u32,
    episode: Option<u32>,
    episode_range: Option<String>,
    meta_json: Option<String>,
) -> CommandResult<()> {
    lifecycle::add_torrent_and_track(url, subject_id, episode, episode_range, meta_json).await
}

#[tauri::command]
pub async fn get_tracked_downloads() -> CommandResult<Vec<DownloadItem>> {
    lifecycle::list_status_projection().await
}

#[tauri::command]
pub async fn get_live_download_info() -> CommandResult<Vec<client::TorrentInfo>> {
    lifecycle::live_download_info().await
}

#[tauri::command]
pub async fn pause_download(hash: String) -> CommandResult<()> {
    lifecycle::pause(&hash).await
}

#[tauri::command]
pub async fn resume_download(hash: String) -> CommandResult<()> {
    lifecycle::resume(&hash).await
}

#[tauri::command]
pub async fn delete_download(hash: String, delete_files: bool) -> CommandResult<()> {
    lifecycle::delete(hash, delete_files).await
}

#[tauri::command]
pub async fn open_download_folder(app: tauri::AppHandle, save_path: String) -> CommandResult<()> {
    app.opener()
        .open_path(save_path, None::<&str>)
        .map_err(|e| AppError::Any(format!("Failed to open folder: {}", e)))?;
    Ok(())
}

#[tauri::command]
pub async fn play_video(app: tauri::AppHandle, hash: String) -> CommandResult<()> {
    let path = lifecycle::playable_file_path(&hash).await?;
    app.opener()
        .open_path(path.to_string_lossy().to_string(), None::<&str>)
        .map_err(|e| AppError::Any(format!("Failed to play video: {}", e)))?;
    Ok(())
}
