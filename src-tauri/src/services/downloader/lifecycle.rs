use super::{
    build_metadata, client, config, extract_resolution, parse_metadata, repo,
    DownloadExternalState, DownloadItem,
};
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
    meta_str.as_ref().and_then(|s| parse_metadata(s)).is_some()
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
        let hash =
            client::parse_magnet_btih(url).ok_or_else(|| AppError::Any("invalid_magnet".into()))?;
        return Ok((hash, TorrentPayload::Magnet));
    }

    wait_api_limit().await;
    let resp = CLIENT.get(url).send().await?;
    resp.error_for_status_ref()?;

    if let Some(len) = resp.content_length() {
        if len > MAX_TORRENT_SIZE as u64 {
            return Err(AppError::Any("torrent_file_too_large".into()));
        }
    }

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
) -> Vec<(String, String, Option<String>)> {
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

    let mut updated_hashes = HashSet::new();
    for t in tracked {
        if !is_metadata_valid(&t.meta_json) {
            if let Some((_, _, meta_json)) = fetched_metadata.get(&t.subject_id) {
                if !updated_hashes.contains(&t.hash) {
                    if let Err(e) = repo::update_meta(t.hash.clone(), meta_json.clone()).await {
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
            if let Some((title, cover)) = t.meta_json.as_ref().and_then(|m| parse_metadata(m)) {
                return (title, cover, t.meta_json.clone());
            }

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

            if let Some((title, cover, meta_json)) = fetched_metadata.get(&t.subject_id) {
                return (title.clone(), cover.clone(), Some(meta_json.clone()));
            }

            ("Unknown".to_string(), String::new(), None)
        })
        .collect()
}

fn build_projection(
    tracked: Vec<repo::TrackedDownload>,
    metadata_list: Vec<(String, String, Option<String>)>,
    live_infos: Option<Vec<client::TorrentInfo>>,
) -> Vec<DownloadItem> {
    tracked
        .into_iter()
        .zip(metadata_list.into_iter())
        .map(|(t, (title, cover, new_meta))| {
            let live = live_infos
                .as_ref()
                .and_then(|infos| infos.iter().find(|l| l.hash == t.hash));

            if let Some(l) = live {
                let resolution = extract_resolution(Some(&l.name), &title);
                DownloadItem {
                    hash: t.hash,
                    subject_id: t.subject_id,
                    episode: t.episode,
                    episode_range: t.episode_range,
                    resolution,
                    external_state: DownloadExternalState::Live {
                        status: l.state.clone(),
                    },
                    progress: l.progress * 100.0,
                    dlspeed: l.dlspeed,
                    eta: l.eta,
                    title,
                    cover,
                    meta_json: new_meta.or(t.meta_json),
                    save_path: Some(l.save_path.clone()),
                }
            } else {
                let external_state = if live_infos.is_some() {
                    DownloadExternalState::Missing
                } else {
                    DownloadExternalState::Stale
                };
                let resolution = extract_resolution(None, &title);
                DownloadItem {
                    hash: t.hash,
                    subject_id: t.subject_id,
                    episode: t.episode,
                    episode_range: t.episode_range,
                    resolution,
                    external_state,
                    progress: 0.0,
                    dlspeed: 0,
                    eta: 0,
                    title,
                    cover,
                    meta_json: new_meta.or(t.meta_json),
                    save_path: None,
                }
            }
        })
        .collect()
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
    let items = build_projection(tracked, metadata_list, live_infos);

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
        .ok_or_else(|| AppError::Any("Torrent not found".into()))?;
    let files = qb.get_torrent_files(hash).await?;
    let video_file = files
        .iter()
        .find(|f| {
            let name_lower = f.name.to_lowercase();
            client::VIDEO_EXTENSIONS
                .iter()
                .any(|ext| name_lower.ends_with(ext))
        })
        .ok_or_else(|| AppError::Any("No video file found".into()))?;

    Ok(std::path::Path::new(&save_path).join(&video_file.name))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tracked(hash: &str, subject_id: u32) -> repo::TrackedDownload {
        repo::TrackedDownload {
            id: 1,
            hash: hash.to_string(),
            subject_id,
            episode: Some(1),
            episode_range: None,
            meta_json: None,
            created_at: 1,
            updated_at: 1,
        }
    }

    fn live(hash: &str) -> client::TorrentInfo {
        client::TorrentInfo {
            hash: hash.to_string(),
            name: "Anime - 01 1080p".to_string(),
            state: "downloading".to_string(),
            progress: 0.5,
            dlspeed: 1024,
            eta: 60,
            save_path: "/tmp/anime".to_string(),
        }
    }

    #[test]
    fn projects_live_state_when_external_download_matches() {
        let items = build_projection(
            vec![tracked("hash-a", 1)],
            vec![("Anime".to_string(), "cover".to_string(), None)],
            Some(vec![live("hash-a")]),
        );

        match &items[0].external_state {
            DownloadExternalState::Live { status } => assert_eq!(status, "downloading"),
            _ => panic!("expected live state"),
        }
        assert_eq!(items[0].progress, 50.0);
        assert_eq!(items[0].save_path.as_deref(), Some("/tmp/anime"));
    }

    #[test]
    fn projects_missing_state_when_external_downloader_has_no_hash() {
        let items = build_projection(
            vec![tracked("hash-a", 1)],
            vec![("Anime".to_string(), "cover".to_string(), None)],
            Some(vec![live("hash-b")]),
        );

        assert!(matches!(
            items[0].external_state,
            DownloadExternalState::Missing
        ));
    }

    #[test]
    fn projects_stale_state_when_external_state_is_unavailable() {
        let items = build_projection(
            vec![tracked("hash-a", 1)],
            vec![("Anime".to_string(), "cover".to_string(), None)],
            None,
        );

        assert!(matches!(
            items[0].external_state,
            DownloadExternalState::Stale
        ));
    }
}
