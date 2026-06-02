use super::{config, lifecycle, DownloadItem};
use tauri::{AppHandle, Emitter};
use tokio::time::{interval, Duration};

pub fn spawn_status_monitor(app_handle: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let mut ticker = interval(Duration::from_millis(1000));
        let mut last_connection_state = false;

        loop {
            tokio::select! {
                _ = ticker.tick() => {
                    match lifecycle::status_snapshot().await {
                        Ok(snapshot) => {
                            if snapshot.connected != last_connection_state {
                                let _ = app_handle.emit("downloader-connection-state", snapshot.connected);
                                last_connection_state = snapshot.connected;
                            }
                            let _ = app_handle.emit("download-status-updated", snapshot.items);
                        }
                        Err(e) => {
                            tracing::error!("Failed to build download status snapshot: {}", e);
                            if last_connection_state {
                                let _ = app_handle.emit("downloader-connection-state", false);
                                last_connection_state = false;
                            }
                            let _ = app_handle.emit("download-status-updated", Vec::<DownloadItem>::new());
                        }
                    }
                }
                _ = config::CONFIG_CHANGED.notified() => {
                    tracing::info!("Downloader config changed");
                }
            }
        }
    });
}
