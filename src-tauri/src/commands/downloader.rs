use crate::error::AppError;
use crate::error::CommandResult;
use crate::infra::http::{wait_api_limit, CLIENT};
use crate::services::downloader::{client, config, repo};
use futures::StreamExt;
use serde::Serialize;
use ts_rs::TS;

#[derive(Serialize, TS)]
#[ts(export, export_to = "../../src/types/gen/downloader.ts")]
pub struct DownloadItem {
    pub hash: String,
    pub subject_id: u32,
    pub episode: Option<u32>,
    pub status: String,
    pub progress: f64,
    pub dlspeed: i64,
    pub eta: i64,
    pub title: String,
    pub cover: String,
    #[ts(optional)]
    pub meta_json: Option<String>,
}

// 辅助函数：获取已认证的客户端
async fn get_client() -> CommandResult<client::QbitClient> {
    let conf = config::get_config().await?;
    let mut qb = client::QbitClient::new(conf);
    qb.login().await?;
    Ok(qb)
}

#[tauri::command]
pub async fn get_downloader_config() -> CommandResult<config::DownloaderConfig> {
    config::get_config().await
}

#[tauri::command]
pub async fn set_downloader_config(config: config::DownloaderConfig) -> CommandResult<()> {
    config::save_config(config).await
}

#[tauri::command]
pub async fn add_torrent_and_track(
    url: String,
    subject_id: u32,
    episode: Option<u32>,
    meta_json: Option<String>,
) -> CommandResult<()> {
    const MAX_TORRENT_SIZE: usize = 20 * 1024 * 1024;

    // 1. 准备哈希和数据
    let (hash, torrent_data) = if url.starts_with("magnet:") {
        let hash = client::parse_magnet_btih(&url)
            .ok_or_else(|| AppError::Any("invalid_magnet".into()))?;
        (hash, None)
    } else {
        wait_api_limit().await;
        let resp = CLIENT.get(&url).send().await?;
        resp.error_for_status_ref()?;

        // 先检查 Content-Length（如果存在）
        if let Some(len) = resp.content_length() {
            if len > MAX_TORRENT_SIZE as u64 {
                return Err(AppError::Any("torrent_file_too_large".into()));
            }
        }

        // 流式读取，限制最大大小
        let mut bytes_stream = resp.bytes_stream();
        let mut buffer = Vec::new();
        let mut total_size = 0usize;

        while let Some(chunk_result) = bytes_stream.next().await {
            let chunk = chunk_result?;
            total_size += chunk.len();

            if total_size > MAX_TORRENT_SIZE {
                return Err(AppError::Any("torrent_file_too_large".into()));
            }

            buffer.extend_from_slice(&chunk);
        }

        let hash = client::calculate_info_hash(&buffer)?;
        (hash, Some(buffer))
    };

    // 2. 先记录到数据库
    repo::insert(
        &hash,
        subject_id,
        episode,
        "downloading",
        None,
        meta_json.as_deref(),
    )
    .await?;

    // 3. 添加到 qBittorrent
    let qb = get_client().await?;
    let result = if let Some(data) = torrent_data {
        qb.add_torrent(data).await
    } else {
        qb.add_url(&url).await
    };

    // 4. 失败时回滚
    if let Err(e) = result {
        let _ = repo::delete(hash.clone()).await;
        return Err(e);
    }

    Ok(())
}

async fn batch_ensure_metadata(
    tracked: &[repo::TrackedDownload],
) -> Vec<(String, String, Option<String>)> {
    use std::collections::HashMap;

    // 1. 尝试从本地索引批量获取
    let subject_ids: Vec<u32> = tracked.iter().map(|t| t.subject_id).collect();
    let index_metadata = crate::services::subscriptions::batch_get_metadata(&subject_ids)
        .await
        .unwrap_or_else(|_| HashMap::new());

    // 2. 找出缺失的 subject_id
    let missing_ids: Vec<u32> = tracked
        .iter()
        .filter(|t| {
            !index_metadata.contains_key(&t.subject_id)
                || t.meta_json.as_ref().map_or(true, |meta| {
                    let parsed = serde_json::from_str::<serde_json::Value>(meta).ok();
                    parsed.and_then(|v| {
                        let title = v.get("resource_title").and_then(|s| s.as_str());
                        let cover = v.get("cover_url").and_then(|s| s.as_str());
                        Some(title.unwrap_or("").is_empty() || cover.unwrap_or("").is_empty())
                    }).unwrap_or(true)
                })
        })
        .map(|t| t.subject_id)
        .collect();

    // 3. 批量从 API 获取缺失的元数据
    let mut fetched_metadata: HashMap<u32, (String, String, String)> = HashMap::new();
    if !missing_ids.is_empty() {
        for subject_id in &missing_ids {
            if let Ok(subject) = crate::services::bangumi::api::fetch_subject(*subject_id).await {
                let title = if subject.name_cn.is_empty() {
                    subject.name.clone()
                } else {
                    subject.name_cn.clone()
                };
                let cover = subject.images.large.clone();
                let new_meta = serde_json::json!({
                    "resource_title": title,
                    "cover_url": cover
                })
                .to_string();

                fetched_metadata.insert(*subject_id, (title, cover, new_meta));
            }
        }
    }

    // 4. 批量更新数据库
    for (subject_id, (_, _, meta)) in &fetched_metadata {
        for t in tracked {
            if t.subject_id == *subject_id && t.meta_json.as_ref().map_or(true, |m| {
                let parsed = serde_json::from_str::<serde_json::Value>(m).ok();
                parsed.and_then(|v| {
                    let title = v.get("resource_title").and_then(|s| s.as_str());
                    let cover = v.get("cover_url").and_then(|s| s.as_str());
                    Some(title.unwrap_or("").is_empty() || cover.unwrap_or("").is_empty())
                }).unwrap_or(true)
            }) {
                let _ = repo::update_meta(t.hash.clone(), meta.clone()).await;
            }
        }
    }

    // 5. 组装结果
    tracked
        .iter()
        .map(|t| {
            // 先检查 meta_json 是否已有效
            if let Some(meta_str) = &t.meta_json {
                if let Ok(meta) = serde_json::from_str::<serde_json::Value>(meta_str) {
                    let title = meta
                        .get("resource_title")
                        .and_then(|v| v.as_str())
                        .unwrap_or("");
                    let cover = meta.get("cover_url").and_then(|v| v.as_str()).unwrap_or("");
                    if !title.is_empty() && !cover.is_empty() {
                        return (title.to_string(), cover.to_string(), Some(meta_str.clone()));
                    }
                }
            }

            // 从索引获取
            if let Some(meta) = index_metadata.get(&t.subject_id) {
                let title = if meta.name_cn.is_empty() {
                    meta.name.clone()
                } else {
                    meta.name_cn.clone()
                };
                if !title.is_empty() && !meta.cover_url.is_empty() {
                    let new_meta = serde_json::json!({
                        "resource_title": title,
                        "cover_url": meta.cover_url
                    })
                    .to_string();
                    return (title, meta.cover_url.clone(), Some(new_meta));
                }
            }

            // 从 API 获取
            if let Some((title, cover, meta)) = fetched_metadata.get(&t.subject_id) {
                return (title.clone(), cover.clone(), Some(meta.clone()));
            }

            ("Unknown".to_string(), String::new(), None)
        })
        .collect()
}

#[tauri::command]
pub async fn get_tracked_downloads() -> CommandResult<Vec<DownloadItem>> {
    let tracked = repo::list().await?;

    // 批量获取元数据
    let metadata_list = batch_ensure_metadata(&tracked).await;

    let items = tracked
        .into_iter()
        .zip(metadata_list.into_iter())
        .map(|(t, (title, cover, new_meta))| DownloadItem {
            hash: t.hash,
            subject_id: t.subject_id,
            episode: t.episode,
            status: t.status,
            progress: 0.0,
            dlspeed: 0,
            eta: 0,
            title,
            cover,
            meta_json: new_meta.or(t.meta_json),
        })
        .collect();

    Ok(items)
}

#[tauri::command]
pub async fn get_live_download_info() -> CommandResult<Vec<client::TorrentInfo>> {
    let tracked = repo::list().await?;
    if tracked.is_empty() {
        return Ok(vec![]);
    }
    let hashes: Vec<String> = tracked.iter().map(|t| t.hash.clone()).collect();

    let qb = get_client().await?;
    let infos = qb.get_torrents_info(hashes).await?;
    Ok(infos)
}

#[tauri::command]
pub async fn pause_download(hash: String) -> CommandResult<()> {
    let mut qb = get_client().await?;
    qb.pause(&hash).await?;
    repo::update_status(hash, "paused".to_string(), None).await?;
    Ok(())
}

#[tauri::command]
pub async fn resume_download(hash: String) -> CommandResult<()> {
    let mut qb = get_client().await?;
    qb.resume(&hash).await?;
    repo::update_status(hash, "downloading".to_string(), None).await?;
    Ok(())
}

#[tauri::command]
pub async fn delete_download(hash: String, delete_files: bool) -> CommandResult<()> {
    let qb = get_client().await?;
    qb.delete(&hash, delete_files).await?;
    repo::delete(hash).await?;
    Ok(())
}
