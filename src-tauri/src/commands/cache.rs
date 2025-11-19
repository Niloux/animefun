use crate::error::{AppError, CommandResult};

#[tauri::command]
pub async fn cache_image(app: tauri::AppHandle, url: String) -> CommandResult<String> {
    crate::infra::media_cache::cache_image(app, url).await
}

pub async fn cleanup_images(app: tauri::AppHandle) -> Result<(), AppError> {
    crate::infra::media_cache::cleanup_images(app).await
}