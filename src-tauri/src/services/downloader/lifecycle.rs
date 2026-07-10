use super::{build_metadata, client, config, projection, repo, DownloadItem};
use crate::error::AppError;
use crate::infra::http::{wait_api_limit, CLIENT};
use futures::StreamExt;
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;

const MAX_TORRENT_SIZE: usize = 20 * 1024 * 1024;

pub struct DownloadStatusSnapshot {
    pub items: Vec<DownloadItem>,
    pub connected: bool,
}

enum TorrentPayload {
    Magnet,
    File(Vec<u8>),
}

fn is_metadata_valid(meta_str: &Option<String>) -> bool {
    projection::has_valid_saved_metadata(meta_str.as_deref())
}

async fn authenticated_client() -> Result<client::QbitClient, AppError> {
    let conf = config::get_config().await?;
    let mut qb = client::QbitClient::new(conf);
    qb.login().await?;
    Ok(qb)
}

pub async fn test_connection() -> Result<String, AppError> {
    let qb = authenticated_client().await?;
    qb.get_app_version().await
}

async fn torrent_payload(url: &str) -> Result<(String, TorrentPayload), AppError> {
    if url.starts_with("magnet:") {
        let hash = client::parse_magnet_btih(url).ok_or(AppError::InvalidMagnet)?;
        return Ok((hash, TorrentPayload::Magnet));
    }

    wait_api_limit().await;
    let resp = CLIENT.get(url).send().await?;
    resp.error_for_status_ref()?;

    if let Some(len) = resp.content_length() {
        if len > MAX_TORRENT_SIZE as u64 {
            return Err(AppError::TorrentFileTooLarge);
        }
    }

    let mut bytes_stream = resp.bytes_stream();
    let mut buffer = Vec::new();
    let mut total_size = 0usize;

    while let Some(chunk_result) = bytes_stream.next().await {
        let chunk = chunk_result?;
        total_size += chunk.len();

        if total_size > MAX_TORRENT_SIZE {
            return Err(AppError::TorrentFileTooLarge);
        }

        buffer.extend_from_slice(&chunk);
    }

    let hash = client::calculate_info_hash(&buffer)?;
    Ok((hash, TorrentPayload::File(buffer)))
}

pub async fn add_torrent_and_track(
    url: String,
    subject_id: u32,
    episode: Option<u32>,
    episode_range: Option<String>,
    meta_json: Option<String>,
) -> Result<(), AppError> {
    let (hash, payload) = torrent_payload(&url).await?;
    let qb = authenticated_client().await?;

    let existing = qb.get_torrents_info(vec![hash.clone()]).await?;
    if !existing.is_empty() {
        return Err(AppError::TorrentAlreadyExists);
    }

    match payload {
        TorrentPayload::File(data) => qb.add_torrent(data).await?,
        TorrentPayload::Magnet => qb.add_url(&url).await?,
    }

    if let Err(e) = repo::insert(
        &hash,
        subject_id,
        episode,
        episode_range.as_deref(),
        meta_json.as_deref(),
    )
    .await
    {
        if let Err(del_err) = qb.delete(&hash, false).await {
            tracing::error!(
                "rollback external download failed hash={}, error={}",
                hash,
                del_err
            );
        }
        return Err(e);
    }

    Ok(())
}

async fn batch_ensure_metadata(
    tracked: &[repo::TrackedDownload],
) -> Vec<projection::DownloadDisplayMetadata> {
    use crate::services::subscriptions::SubjectMetadata;

    let subject_ids: Vec<u32> = tracked.iter().map(|t| t.subject_id).collect();
    let index_metadata: HashMap<u32, SubjectMetadata> =
        match crate::services::subscriptions::batch_get_metadata(&subject_ids).await {
            Ok(meta) => meta,
            Err(e) => {
                tracing::warn!("从索引批量获取元数据失败: {}, 降级到逐个获取", e);
                HashMap::new()
            }
        };

    let missing_ids: Vec<u32> = tracked
        .iter()
        .filter(|t| !index_metadata.contains_key(&t.subject_id) || !is_metadata_valid(&t.meta_json))
        .map(|t| t.subject_id)
        .collect();

    let mut fetched_metadata: HashMap<u32, projection::FetchedDisplayMetadata> = HashMap::new();
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
                    fetched_metadata.insert(
                        *subject_id,
                        projection::FetchedDisplayMetadata {
                            title,
                            cover,
                            meta_json,
                        },
                    );
                }
                Err(e) => {
                    tracing::warn!("获取 subject_id={} 元数据失败: {}", subject_id, e);
                }
            }
        }
    }

    let mut updated_hashes = HashSet::new();
    for t in tracked {
        if !is_metadata_valid(&t.meta_json) {
            if let Some(meta) = fetched_metadata.get(&t.subject_id) {
                if !updated_hashes.contains(&t.hash) {
                    if let Err(e) = repo::update_meta(t.hash.clone(), meta.meta_json.clone()).await
                    {
                        tracing::warn!(
                            "更新下载元数据失败 hash={}, subject_id={}, error={}",
                            t.hash,
                            t.subject_id,
                            e
                        );
                    }
                    updated_hashes.insert(t.hash.clone());
                }
            }
        }
    }

    tracked
        .iter()
        .map(|t| {
            let index = index_metadata
                .get(&t.subject_id)
                .map(subject_metadata_to_display_metadata);
            projection::select_display_metadata(
                t.meta_json.as_deref(),
                index.as_ref(),
                fetched_metadata.get(&t.subject_id),
            )
        })
        .collect()
}

fn subject_metadata_to_display_metadata(
    meta: &crate::services::subscriptions::SubjectMetadata,
) -> projection::SubjectDisplayMetadata {
    projection::SubjectDisplayMetadata {
        name: meta.name.clone(),
        name_cn: meta.name_cn.clone(),
        cover_url: meta.cover_url.clone(),
    }
}

pub async fn status_snapshot() -> Result<DownloadStatusSnapshot, AppError> {
    let tracked = repo::list().await?;

    if tracked.is_empty() {
        let connected = match authenticated_client().await {
            Ok(qb) => qb.get_app_version().await.is_ok(),
            Err(_) => false,
        };
        return Ok(DownloadStatusSnapshot {
            items: Vec::new(),
            connected,
        });
    }

    let metadata_list = batch_ensure_metadata(&tracked).await;
    let live_infos = match authenticated_client().await {
        Ok(qb) => {
            let hashes: Vec<String> = tracked.iter().map(|t| t.hash.clone()).collect();
            match qb.get_torrents_info(hashes).await {
                Ok(infos) => Some(infos),
                Err(e) => {
                    tracing::warn!("Failed to get torrent info: {}", e);
                    None
                }
            }
        }
        Err(e) => {
            tracing::warn!("Qbit login failed: {}", e);
            None
        }
    };
    let connected = live_infos.is_some();
    let items = projection::build_status_projection(tracked, metadata_list, live_infos);

    Ok(DownloadStatusSnapshot { items, connected })
}

pub async fn list_status_projection() -> Result<Vec<DownloadItem>, AppError> {
    Ok(status_snapshot().await?.items)
}

pub async fn live_download_info() -> Result<Vec<client::TorrentInfo>, AppError> {
    let qb = authenticated_client().await?;
    let tracked = repo::list().await?;
    if tracked.is_empty() {
        return Ok(vec![]);
    }
    let hashes: Vec<String> = tracked.iter().map(|t| t.hash.clone()).collect();
    qb.get_torrents_info(hashes).await
}

pub async fn pause(hash: &str) -> Result<(), AppError> {
    let mut qb = authenticated_client().await?;
    qb.pause(hash).await
}

pub async fn resume(hash: &str) -> Result<(), AppError> {
    let mut qb = authenticated_client().await?;
    qb.resume(hash).await
}

pub async fn delete(hash: String, delete_files: bool) -> Result<(), AppError> {
    let qb = authenticated_client().await?;
    qb.delete(&hash, delete_files).await?;
    repo::delete(hash).await
}

pub async fn playable_file_path(hash: &str) -> Result<PathBuf, AppError> {
    let qb = authenticated_client().await?;
    let infos = qb.get_torrents_info(vec![hash.to_string()]).await?;
    let save_path = infos
        .first()
        .map(|t| t.save_path.clone())
        .ok_or(AppError::DownloadNotFound)?;
    let files = qb.get_torrent_files(hash).await?;
    let video_file = files
        .iter()
        .find(|f| {
            let name_lower = f.name.to_lowercase();
            client::VIDEO_EXTENSIONS
                .iter()
                .any(|ext| name_lower.ends_with(ext))
        })
        .ok_or(AppError::PlayableFileNotFound)?;

    Ok(std::path::Path::new(&save_path).join(&video_file.name))
}
