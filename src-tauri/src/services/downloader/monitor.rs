use super::{client, config, parse_metadata, repo, DownloadItem};
use tauri::{AppHandle, Emitter};
use tokio::time::{interval, Duration};

pub fn spawn_status_monitor(app_handle: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let mut ticker = interval(Duration::from_millis(1000));
        let mut client: Option<client::QbitClient> = None;
        let mut last_connection_state = false;

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
                    // 如果没有任务，我们也认为连接是OK的（只要 client 没报错）
                    // 但为了保活，我们可以发一个轻量级请求，或者简单地假设 OK
                    // 这里简化逻辑：如果没有任务，不发请求，但维持连接状态为 true
                    // 除非我们想做心跳检测。
                    // 为了简单起见，如果 tracked 为空，我们暂时无法验证连接，
                    // 但用户体验上，如果没有任务，连接状态不那么重要，除非用户想添加任务。
                    // 让我们做一个小小的心跳检测？或者直接假设 true。
                    // 考虑到 UX，如果没任务，用户看不到列表，也就不会有 Error 页。
                    // 但是下载按钮需要状态。
                    // 还是做个版本检查当心跳吧，或者直接忽略。
                    // 实际上，如果 tracked 为空，我们可以尝试获取 app version 来检测连接。
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

            // 5. 如果有任务，合并数据并推送
            // 注意：即使没连接，如果 tracked 不为空，我们也推送数据（显示为 stopped/unknown）
            // 这样用户至少能看到列表（虽然是 error 状态下的）
            // 但前端现在的逻辑是：没连接就显示 Error 页。
            // 所以这里推送的数据其实前端可能不会渲染，或者渲染在 Error 页之下。
            if !tracked.is_empty() {
                let items = merge_items(tracked, live_infos);
                let _ = app_handle.emit("download-status-updated", items);
            } else {
                // 如果为空，也推送空列表，清空前端
                let _ = app_handle.emit("download-status-updated", Vec::<DownloadItem>::new());
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
