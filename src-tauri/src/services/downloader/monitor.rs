use super::{client, config, parse_metadata, repo, DownloadItem};
use tauri::{AppHandle, Emitter};
use tokio::time::{interval, Duration};

pub fn spawn_status_monitor(app_handle: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let mut ticker = interval(Duration::from_millis(500));
        let mut client: Option<client::QbitClient> = None;

        loop {
            ticker.tick().await;

            // 1. 获取数据库中的追踪项
            let tracked = match repo::list().await {
                Ok(t) => t,
                Err(e) => {
                    tracing::error!("Failed to fetch tracked downloads: {}", e);
                    continue;
                }
            };

            if tracked.is_empty() {
                // 如果没有下载任务，发送空列表并清空客户端（节省资源）
                let _ = app_handle.emit("download-status-updated", Vec::<DownloadItem>::new());
                client = None;
                continue;
            }

            // 2. 确保客户端已初始化
            if client.is_none() {
                match config::get_config().await {
                    Ok(conf) => {
                        let mut qb = client::QbitClient::new(conf);
                        // 尝试登录
                        if let Err(e) = qb.login().await {
                            tracing::warn!("Qbit login failed: {}", e);
                            // 登录失败不中断循环，可能是暂时不可用，下个循环重试
                        }
                        client = Some(qb);
                    }
                    Err(e) => {
                        tracing::error!("Failed to load config: {}", e);
                    }
                }
            }

            // 3. 如果有客户端，尝试获取实时信息
            let live_infos = if let Some(qb) = &client {
                let hashes: Vec<String> = tracked.iter().map(|t| t.hash.clone()).collect();
                match qb.get_torrents_info(hashes).await {
                    Ok(infos) => infos,
                    Err(e) => {
                        tracing::warn!(
                            "Failed to get torrent info: {}, will retry login next time",
                            e
                        );
                        // 如果获取失败，可能是 session 过期，置空 client 触发重连
                        client = None;
                        vec![]
                    }
                }
            } else {
                vec![]
            };

            // 4. 合并数据并推送
            let items = merge_items(tracked, live_infos);
            let _ = app_handle.emit("download-status-updated", items);
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
