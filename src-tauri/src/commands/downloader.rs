use crate::error::CommandResult;
use crate::infra::http::CLIENT;
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
    config::get_config().await.map_err(Into::into)
}

#[tauri::command]
pub async fn set_downloader_config(config: config::DownloaderConfig) -> CommandResult<()> {
    config::save_config(config).await.map_err(Into::into)
}

#[tauri::command]
pub async fn add_torrent_and_track(
    url: String,
    subject_id: u32,
    episode: Option<u32>,
    meta_json: Option<String>,
) -> CommandResult<()> {
    // wait_api_limit().await;
    let resp = CLIENT.get(&url).send().await?;
    resp.error_for_status_ref()?;
    let bytes = resp.bytes().await?.to_vec();

    let hash = client::calculate_info_hash(&bytes)?;

    // 先插入数据库
    repo::insert(
        &hash,
        subject_id,
        episode,
        "downloading",
        None,
        meta_json.as_deref(),
    )
    .await?;

    // 数据库插入成功后，再添加到qBittorrent
    let conf = config::get_config().await?;
    let mut qb = client::QbitClient::new(&conf);
    qb.login(&conf).await?;

    match qb.add_torrent(bytes).await {
        Ok(_) => Ok(()),
        Err(e) => {
            // 如果qBittorrent添加失败，回滚数据库操作
            let _ = repo::delete(hash.clone()).await;
            Err(e.into())
        }
    }
}

async fn get_title_and_cover(meta_json: Option<&str>, subject_id: u32) -> (String, String) {
    // 尝试从meta_json解析
    let (mut title, mut cover) =
        match meta_json.and_then(|mjs| serde_json::from_str::<serde_json::Value>(mjs).ok()) {
            Some(meta) => (
                meta.get("resource_title")
                    .and_then(|v| v.as_str())
                    .unwrap_or_default()
                    .to_string(),
                meta.get("cover_url")
                    .and_then(|v| v.as_str())
                    .unwrap_or_default()
                    .to_string(),
            ),
            None => (String::new(), String::new()),
        };

    // meta_json获取失败或信息不全，尝试API请求
    if title.is_empty() || cover.is_empty() {
        if let Ok(subject) = crate::services::bangumi::api::fetch_subject(subject_id).await {
            title = if title.is_empty() {
                subject.name_cn
            } else {
                title
            };
            cover = if cover.is_empty() {
                subject.images.large
            } else {
                cover
            };
        }
    }

    // 设置默认标题
    let title = if title.is_empty() {
        "Unknown".to_string()
    } else {
        title
    };

    (title, cover)
}

#[tauri::command]
pub async fn get_tracked_downloads() -> CommandResult<Vec<DownloadItem>> {
    let tracked = repo::list().await?;
    let mut result = Vec::with_capacity(tracked.len());

    for t in tracked {
        let (title, cover) = get_title_and_cover(t.meta_json.as_deref(), t.subject_id).await;
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
            meta_json: t.meta_json,
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
