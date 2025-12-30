use once_cell::sync::OnceCell;
use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;
use tracing::{error, info};

static APP_HANDLE: OnceCell<AppHandle> = OnceCell::new();

/// Initialize the notification module with the AppHandle
pub fn init(handle: AppHandle) {
    if let Err(_) = APP_HANDLE.set(handle) {
        #[cfg(debug_assertions)]
        panic!("Notification module initialized multiple times");

        #[cfg(not(debug_assertions))]
        error!("Notification module initialized multiple times, notification will not work correctly");
    }
}

/// Send a desktop notification for new episode
pub fn notify_new_episode(anime_name: &str, episode: u32) {
    let title = format!("{} 更新提醒", anime_name);
    let body = format!("第 {} 话资源已发布", episode);

    info!(
        anime = anime_name,
        episode, "sending new episode notification"
    );

    if let Some(handle) = APP_HANDLE.get() {
        if let Err(e) = handle
            .notification()
            .builder()
            .title(&title)
            .body(&body)
            .show()
        {
            error!(
                error = %e,
                anime = anime_name,
                episode,
                "failed to send notification"
            );
        }
    } else {
        error!(
            anime = anime_name,
            episode, "app handle not initialized, cannot send notification"
        );
    }
}

/// Send a test notification
pub fn notify_test() {
    if let Some(handle) = APP_HANDLE.get() {
        if let Err(e) = handle
            .notification()
            .builder()
            .title("AnimeFun 测试通知")
            .body("通知功能正常工作")
            .show()
        {
            error!(error = %e, "failed to send test notification");
        }
    } else {
        error!("app handle not initialized, cannot send test notification");
    }
}
