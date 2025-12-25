use crate::error::AppError;
use crate::error::CommandResult;
use crate::infra::http::{wait_api_limit, CLIENT};
use crate::services::downloader::{client, config, repo};
use futures::StreamExt;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use ts_rs::TS;

#[derive(Serialize, TS)]
#[ts(export, export_to = "../../src/types/gen/downloader.ts")]
pub struct DownloadItem {
    pub hash: String,
    pub subject_id: u32,
    pub episode: Option<u32>,
    pub progress: f64,
    pub dlspeed: i64,
    pub eta: i64,
    pub title: String,
    pub cover: String,
    pub status: String,
    #[ts(optional)]
    pub meta_json: Option<String>,
}

// 元数据辅助结构
#[derive(Debug, Clone, Deserialize)]
struct Metadata {
    resource_title: String,
    cover_url: String,
}

fn parse_metadata(meta_str: &str) -> Option<(String, String)> {
    let meta: Metadata = serde_json::from_str(meta_str).ok()?;
    if meta.resource_title.is_empty() || meta.cover_url.is_empty() {
        return None;
    }
    Some((meta.resource_title, meta.cover_url))
}

fn is_metadata_valid(meta_str: &Option<String>) -> bool {
    meta_str
        .as_ref()
        .and_then(|s| parse_metadata(s))
        .is_some()
}

fn build_metadata(title: String, cover: String) -> String {
    serde_json::json!({
        "resource_title": title,
        "cover_url": cover
    })
    .to_string()
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
        if let Err(del_err) = repo::delete(hash.clone()).await {
            tracing::error!("回滚下载失败 hash={}, error={}", hash, del_err);
        }
        return Err(e);
    }

    Ok(())
}

async fn batch_ensure_metadata(
    tracked: &[repo::TrackedDownload],
) -> Vec<(String, String, Option<String>)> {
    use crate::services::subscriptions::SubjectMetadata;

    // 1. 从本地索引批量获取
    let subject_ids: Vec<u32> = tracked.iter().map(|t| t.subject_id).collect();
    let index_metadata: HashMap<u32, SubjectMetadata> = match crate::services::subscriptions::batch_get_metadata(&subject_ids).await {
        Ok(meta) => meta,
        Err(e) => {
            tracing::warn!("从索引批量获取元数据失败: {}, 降级到逐个获取", e);
            HashMap::new()
        }
    };

    // 2. 找出缺失的 subject_id（索引中没有，或数据库元数据无效）
    let missing_ids: Vec<u32> = tracked
        .iter()
        .filter(|t| {
            !index_metadata.contains_key(&t.subject_id) || !is_metadata_valid(&t.meta_json)
        })
        .map(|t| t.subject_id)
        .collect();

    // 3. 批量从 API 获取缺失的元数据
    let mut fetched_metadata: HashMap<u32, (String, String, String)> = HashMap::new();
    if !missing_ids.is_empty() {
        for subject_id in &missing_ids {
            match crate::services::bangumi::api::fetch_subject(*subject_id).await {
                Ok(subject) => {
                    let title = if subject.name_cn.is_empty() {
                        subject.name.clone()
                    } else {
                        subject.name_cn.clone()
                    };
                    let cover = subject.images.large.clone();
                    let meta_json = build_metadata(title.clone(), cover.clone());
                    fetched_metadata.insert(*subject_id, (title, cover, meta_json));
                }
                Err(e) => {
                    tracing::warn!("获取 subject_id={} 元数据失败: {}", subject_id, e);
                }
            }
        }
    }

    // 4. 批量更新数据库（优化：每个 subject_id 只更新一次）
    for (subject_id, (_, _, meta_json)) in &fetched_metadata {
        for t in tracked {
            if t.subject_id == *subject_id && !is_metadata_valid(&t.meta_json) {
                if let Err(e) = repo::update_meta(t.hash.clone(), meta_json.clone()).await {
                    tracing::warn!("更新下载元数据失败 hash={}, subject_id={}, error={}", t.hash, subject_id, e);
                }
            }
        }
    }

    // 5. 组装结果
    tracked
        .iter()
        .map(|t| {
            // 优先级 1: 使用数据库中的有效元数据
            if let Some((title, cover)) = t.meta_json.as_ref().and_then(|m| parse_metadata(m)) {
                return (title, cover, t.meta_json.clone());
            }

            // 优先级 2: 使用索引元数据
            if let Some(meta) = index_metadata.get(&t.subject_id) {
                let title = if meta.name_cn.is_empty() {
                    meta.name.clone()
                } else {
                    meta.name_cn.clone()
                };
                if !title.is_empty() && !meta.cover_url.is_empty() {
                    let meta_json = build_metadata(title.clone(), meta.cover_url.clone());
                    return (title, meta.cover_url.clone(), Some(meta_json));
                }
            }

            // 优先级 3: 使用 API 获取的元数据
            if let Some((title, cover, meta_json)) = fetched_metadata.get(&t.subject_id) {
                return (title.clone(), cover.clone(), Some(meta_json.clone()));
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
            progress: 0.0,
            dlspeed: 0,
            eta: 0,
            title,
            cover,
            status: String::new(),
            meta_json: new_meta.or(t.meta_json),
        })
        .collect();

    Ok(items)
}

#[tauri::command]
pub async fn get_live_download_info() -> CommandResult<Vec<client::TorrentInfo>> {
    let qb = get_client().await?;

    let tracked = repo::list().await?;
    if tracked.is_empty() {
        return Ok(vec![]);
    }
    let hashes: Vec<String> = tracked.iter().map(|t| t.hash.clone()).collect();

    let infos = qb.get_torrents_info(hashes).await?;
    Ok(infos)
}

#[tauri::command]
pub async fn pause_download(hash: String) -> CommandResult<()> {
    let mut qb = get_client().await?;
    qb.pause(&hash).await?;
    Ok(())
}

#[tauri::command]
pub async fn resume_download(hash: String) -> CommandResult<()> {
    let mut qb = get_client().await?;
    qb.resume(&hash).await?;
    Ok(())
}

#[tauri::command]
pub async fn delete_download(hash: String, delete_files: bool) -> CommandResult<()> {
    let qb = get_client().await?;
    qb.delete(&hash, delete_files).await?;
    repo::delete(hash).await?;
    Ok(())
}
