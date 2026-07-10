use super::{config, lifecycle, DownloadItem};
use tauri::{AppHandle, Emitter};
use tokio::time::{interval, Duration};

#[derive(Default)]
struct MonitorState {
    connected: bool,
}

impl MonitorState {
    fn transition(&mut self, connected: bool) -> Option<bool> {
        if self.connected == connected {
            return None;
        }
        self.connected = connected;
        Some(connected)
    }
}

pub fn spawn_status_monitor(app_handle: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let mut ticker = interval(Duration::from_millis(1000));
        let mut state = MonitorState::default();

        loop {
            tokio::select! {
                _ = ticker.tick() => {
                    poll_once(&app_handle, &mut state).await;
                }
                _ = config::CONFIG_CHANGED.notified() => {
                    tracing::info!("Downloader config changed");
                }
            }
        }
    });
}

async fn poll_once(app_handle: &AppHandle, state: &mut MonitorState) {
    let (connected, items) = match lifecycle::status_snapshot().await {
        Ok(snapshot) => (snapshot.connected, snapshot.items),
        Err(error) => {
            tracing::error!(error = %error, "failed to build download status snapshot");
            (false, Vec::<DownloadItem>::new())
        }
    };

    if let Some(connected) = state.transition(connected) {
        if let Err(error) = app_handle.emit("downloader-connection-state", connected) {
            tracing::error!(error = %error, "failed to emit downloader-connection-state");
        }
    }
    if let Err(error) = app_handle.emit("download-status-updated", items) {
        tracing::error!(error = %error, "failed to emit download-status-updated");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn emits_only_connection_state_transitions() {
        let mut state = MonitorState::default();
        assert_eq!(state.transition(false), None);
        assert_eq!(state.transition(true), Some(true));
        assert_eq!(state.transition(true), None);
        assert_eq!(state.transition(false), Some(false));
    }
}
