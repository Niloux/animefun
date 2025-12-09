use crate::error::AppError;
use crate::error::CommandResult;
use crate::infra::http::{wait_api_limit, CLIENT};
use crate::services::downloader::{client, config, repo};
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
    // 1. 准备哈希和数据
    let (hash, torrent_data) = if url.starts_with("magnet:") {
        let hash = client::parse_magnet_btih(&url)
            .ok_or_else(|| AppError::Any("invalid_magnet".into()))?;
        (hash, None)
    } else {
        wait_api_limit().await;
        let resp = CLIENT.get(&url).send().await?;
        resp.error_for_status_ref()?;

        // 安全检查：防止下载大文件占用过多内存
        if let Some(len) = resp.content_length() {
            if len > 20 * 1024 * 1024 {
                // 限制 .torrent 文件大小为 20MB
                return Err(AppError::Any("torrent_file_too_large".into()));
            }
        }

        let bytes = resp.bytes().await?.to_vec();
        // 下载后再次检查大小
        if bytes.len() > 20 * 1024 * 1024 {
            return Err(AppError::Any("torrent_file_too_large".into()));
        }

        let hash = client::calculate_info_hash(&bytes)?;
        (hash, Some(bytes))
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

async fn ensure_metadata(t: &repo::TrackedDownload) -> (String, String, Option<String>) {
    // 1. 尝试解析现有的 meta_json
    if let Some(meta_str) = &t.meta_json {
        if let Ok(meta) = serde_json::from_str::<serde_json::Value>(meta_str) {
            let title = meta
                .get("resource_title")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let cover = meta.get("cover_url").and_then(|v| v.as_str()).unwrap_or("");
            if !title.is_empty() && !cover.is_empty() {
                return (title.to_string(), cover.to_string(), None);
            }
        }
    }

    // 2. 降级方案：从 API 获取
    // FIXME: 如果多个项目缺少元数据，这将导致 N+1 API 调用。
    // 应该由后台工作线程处理或在摄入时批量处理。
    // 优先级较低，暂不处理。
    if let Ok(subject) = crate::services::bangumi::api::fetch_subject(t.subject_id).await {
        let title = if subject.name_cn.is_empty() {
            subject.name
        } else {
            subject.name_cn
        };
        let cover = subject.images.large;

        let new_meta = serde_json::json!({
            "resource_title": title,
            "cover_url": cover
        })
        .to_string();

        // 副作用：更新数据库
        let _ = repo::update_meta(t.hash.clone(), new_meta.clone()).await;

        return (title, cover, Some(new_meta));
    }

    ("Unknown".to_string(), String::new(), None)
}

#[tauri::command]
pub async fn get_tracked_downloads() -> CommandResult<Vec<DownloadItem>> {
    let tracked = repo::list().await?;

    // 并行处理所有项目
    let tasks: Vec<_> = tracked
        .into_iter()
        .map(|t| async move {
            let (title, cover, new_meta) = ensure_metadata(&t).await;
            DownloadItem {
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
            }
        })
        .collect();

    let result = futures::future::join_all(tasks).await;
    Ok(result)
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
