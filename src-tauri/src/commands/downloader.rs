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
    if url.starts_with("magnet:") {
        let hash = match client::parse_magnet_btih(&url) {
            Some(h) => h,
            None => return Err(AppError::Any("invalid_magnet".into())),
        };
        repo::insert(
            &hash,
            subject_id,
            episode,
            "downloading",
            None,
            meta_json.as_deref(),
        )
        .await?;
        let conf = config::get_config().await?;
        let mut qb = client::QbitClient::new(&conf);
        qb.login(&conf).await?;
        match qb.add_url(&url).await {
            Ok(_) => Ok(()),
            Err(e) => {
                let _ = repo::delete(hash.clone()).await;
                Err(e)
            }
        }
    } else {
        wait_api_limit().await;
        let resp = CLIENT.get(&url).send().await?;
        resp.error_for_status_ref()?;
        let bytes = resp.bytes().await?.to_vec();
        let hash = client::calculate_info_hash(&bytes)?;
        repo::insert(
            &hash,
            subject_id,
            episode,
            "downloading",
            None,
            meta_json.as_deref(),
        )
        .await?;
        let conf = config::get_config().await?;
        let mut qb = client::QbitClient::new(&conf);
        qb.login(&conf).await?;
        match qb.add_torrent(bytes).await {
            Ok(_) => Ok(()),
            Err(e) => {
                let _ = repo::delete(hash.clone()).await;
                Err(e)
            }
        }
    }
}

async fn ensure_metadata(t: &repo::TrackedDownload) -> (String, String, Option<String>) {
    // 尝试从meta_json解析
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

    // meta_json缺失或不全，从API获取并回写
    if let Ok(subject) = crate::services::bangumi::api::fetch_subject(t.subject_id).await {
        let title = if subject.name_cn.is_empty() {
            subject.name
        } else {
            subject.name_cn
        };
        let cover = subject.images.large;

        // 回写到数据库
        let new_meta = serde_json::json!({
            "resource_title": title,
            "cover_url": cover
        })
        .to_string();

        let _ = repo::update_meta(t.hash.clone(), new_meta.clone()).await;

        return (title, cover, Some(new_meta));
    }

    ("Unknown".to_string(), String::new(), None)
}

#[tauri::command]
pub async fn get_tracked_downloads() -> CommandResult<Vec<DownloadItem>> {
    let tracked = repo::list().await?;
    let mut result = Vec::with_capacity(tracked.len());

    for t in tracked {
        let (title, cover, new_meta) = ensure_metadata(&t).await;
        result.push(DownloadItem {
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
        });
    }
    Ok(result)
}

#[tauri::command]
pub async fn get_live_download_info() -> CommandResult<Vec<client::TorrentInfo>> {
    let tracked = repo::list().await?;
    if tracked.is_empty() {
        return Ok(vec![]);
    }
    let hashes: Vec<String> = tracked.iter().map(|t| t.hash.clone()).collect();

    let conf = config::get_config().await?;
    let mut qb = client::QbitClient::new(&conf);
    qb.login(&conf).await?;

    let infos = qb.get_torrents_info(hashes).await?;
    Ok(infos)
}

#[tauri::command]
pub async fn pause_download(hash: String) -> CommandResult<()> {
    let conf = config::get_config().await?;
    let mut qb = client::QbitClient::new(&conf);
    qb.login(&conf).await?;
    qb.pause(&hash).await?;
    repo::update_status(hash, "paused".to_string(), None).await?;
    Ok(())
}

#[tauri::command]
pub async fn resume_download(hash: String) -> CommandResult<()> {
    let conf = config::get_config().await?;
    let mut qb = client::QbitClient::new(&conf);
    qb.login(&conf).await?;
    qb.resume(&hash).await?;
    repo::update_status(hash, "downloading".to_string(), None).await?;
    Ok(())
}

#[tauri::command]
pub async fn delete_download(hash: String, delete_files: bool) -> CommandResult<()> {
    let conf = config::get_config().await?;
    let mut qb = client::QbitClient::new(&conf);
    qb.login(&conf).await?;
    qb.delete(&hash, delete_files).await?;
    repo::delete(hash).await?;
    Ok(())
}
