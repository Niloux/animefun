use super::{client, config, parse_metadata, repo, DownloadItem};
use tauri::{AppHandle, Emitter};
use tokio::time::{interval, Duration};

pub fn spawn_status_monitor(app_handle: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let mut ticker = interval(Duration::from_millis(1000));
        let mut client: Option<client::QbitClient> = None;
        let mut last_connection_state = false;

        loop {
            tokio::select! {
                _ = ticker.tick() => {
                    // 1. 获取数据库中的追踪项
            let tracked = match repo::list().await {
                Ok(t) => t,
                Err(e) => {
                    tracing::error!("Failed to fetch tracked downloads: {}", e);
                    continue;
                }
            };

            // 2. 尝试初始化客户端（如果尚未初始化）
            if client.is_none() {
                match config::get_config().await {
                    Ok(conf) => {
                        let mut qb = client::QbitClient::new(conf);
                        // 尝试登录
                        if let Err(e) = qb.login().await {
                            tracing::warn!("Qbit login failed: {}", e);
                            // 登录失败不中断循环，可能是暂时不可用
                        } else {
                            // 只有登录成功才设置 client
                            client = Some(qb);
                        }
                    }
                    Err(e) => {
                        tracing::error!("Failed to load config: {}", e);
                    }
                }
            }

            // 3. 获取实时信息并判断连接状态
            let (live_infos, is_connected) = if let Some(qb) = &client {
                if tracked.is_empty() {
                    match qb.get_app_version().await {
                        Ok(_) => (vec![], true),
                        Err(_) => {
                            client = None; // 失败则重置
                            (vec![], false)
                        }
                    }
                } else {
                    let hashes: Vec<String> = tracked.iter().map(|t| t.hash.clone()).collect();
                    match qb.get_torrents_info(hashes).await {
                        Ok(infos) => (infos, true),
                        Err(e) => {
                            tracing::warn!(
                                "Failed to get torrent info: {}, will retry login next time",
                                e
                            );
                            client = None;
                            (vec![], false)
                        }
                    }
                }
            } else {
                (vec![], false)
            };

            // 4. 推送连接状态变更
            if is_connected != last_connection_state {
                let _ = app_handle.emit("downloader-connection-state", is_connected);
                last_connection_state = is_connected;
            }

            if !tracked.is_empty() {
                let items = merge_items(tracked, live_infos);
                let _ = app_handle.emit("download-status-updated", items);
            } else {
                // 如果为空，也推送空列表，清空前端
                let _ = app_handle.emit("download-status-updated", Vec::<DownloadItem>::new());
            }
                }
                _ = config::CONFIG_CHANGED.notified() => {
                    tracing::info!("Downloader config changed, reinitializing client");
                    client = None;
                }
            }
        }
    });
}

fn merge_items(
    tracked: Vec<repo::TrackedDownload>,
    live_infos: Vec<client::TorrentInfo>,
) -> Vec<DownloadItem> {
    tracked
        .into_iter()
        .map(|t| {
            let live = live_infos.iter().find(|l| l.hash == t.hash);

            if let Some(l) = live {
                let (title, cover) = t
                    .meta_json
                    .as_deref()
                    .and_then(|s| parse_metadata(s))
                    .unwrap_or_else(|| (l.name.clone(), String::new()));

                DownloadItem {
                    hash: t.hash,
                    subject_id: t.subject_id,
                    episode: t.episode,
                    status: l.state.clone(),
                    progress: l.progress * 100.0,
                    dlspeed: l.dlspeed,
                    eta: l.eta,
                    title,
                    cover,
                    meta_json: t.meta_json,
                }
            } else {
                let (title, cover) = t
                    .meta_json
                    .as_deref()
                    .and_then(|s| parse_metadata(s))
                    .unwrap_or_else(|| ("Unknown".to_string(), String::new()));

                DownloadItem {
                    hash: t.hash,
                    subject_id: t.subject_id,
                    episode: t.episode,
                    status: "stopped".to_string(),
                    progress: 0.0,
                    dlspeed: 0,
                    eta: 0,
                    title,
                    cover,
                    meta_json: t.meta_json,
                }
            }
        })
        .collect()
}
