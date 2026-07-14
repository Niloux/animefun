use crate::error::AppError;
use once_cell::sync::OnceCell;
use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;
use tracing::error;

static APP_HANDLE: OnceCell<AppHandle> = OnceCell::new();

/// Initialize the notification module with the AppHandle
pub fn init(handle: AppHandle) {
    if APP_HANDLE.set(handle).is_err() {
        error!(
            "Notification module initialized multiple times, notification will not work correctly"
        );
    }
}

/// Send a desktop notification with the given title and body
fn send_notification(title: &str, body: &str) -> Result<(), AppError> {
    let handle = APP_HANDLE
        .get()
        .ok_or_else(|| AppError::Any("notification app handle not initialized".to_string()))?;
    handle
        .notification()
        .builder()
        .title(title)
        .body(body)
        .show()
        .map_err(|error| AppError::Any(format!("notification delivery failed: {error}")))
}

/// Send a desktop notification for new episode
pub fn notify_new_episode(anime_name: &str, episode: u32) -> Result<(), AppError> {
    let title = format!("{} 更新提醒", anime_name);
    let body = format!("第 {} 话资源已发布", episode);

    tracing::info!(
        anime = anime_name,
        episode,
        "sending new episode notification"
    );

    send_notification(&title, &body)
}

/// Send a test notification
pub fn notify_test() -> Result<(), AppError> {
    tracing::info!("sending test notification");
    send_notification("AnimeFun 测试通知", "通知功能正常工作")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn uninitialized_app_handle_is_an_error() {
        assert!(APP_HANDLE.get().is_none());
        assert!(send_notification("title", "body").is_err());
    }
}
