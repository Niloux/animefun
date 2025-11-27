use super::config::DownloaderConfig;
use crate::error::AppError;
use reqwest::header::{COOKIE, ORIGIN, REFERER};
use reqwest::{multipart, Client};
use serde::{Deserialize, Serialize};
use sha1::{Digest, Sha1};
use ts_rs::TS;

pub struct QbitClient {
    base_url: String,
    client: Client,
    cookie: Option<String>,
}

#[derive(Deserialize, Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../../src/types/gen/torrent_info.ts")]
pub struct TorrentInfo {
    pub hash: String,
    pub name: String,
    pub state: String,
    pub progress: f64,
    pub dlspeed: i64, // bytes/s
    pub eta: i64,     // seconds
    pub save_path: String,
}

#[derive(Deserialize)]
struct TorrentMeta {
    info: serde_bencode::value::Value,
}

pub fn calculate_info_hash(bytes: &[u8]) -> Result<String, AppError> {
    let meta: TorrentMeta = serde_bencode::from_bytes(bytes)?;
    let info_bytes = serde_bencode::to_bytes(&meta.info)?;
    let mut hasher = Sha1::new();
    hasher.update(&info_bytes);
    let result = hasher.finalize();
    Ok(hex::encode(result))
}

impl QbitClient {
    pub fn new(config: &DownloaderConfig) -> Self {
        Self {
            base_url: config.api_url.clone().trim_end_matches('/').to_string(),
            client: Client::new(),
            cookie: None,
        }
    }

    pub async fn login(&mut self, config: &DownloaderConfig) -> Result<(), AppError> {
        let url = format!("{}/api/v2/auth/login", self.base_url);
        let params = [
            ("username", config.username.as_deref().unwrap_or("")),
            ("password", config.password.as_deref().unwrap_or("")),
        ];

        let resp = self.client.post(&url).form(&params).send().await?;

        resp.error_for_status_ref()?;

        if let Some(cookie) = resp.headers().get("set-cookie") {
            if let Ok(c) = cookie.to_str() {
                let sid = c.split(';').next().unwrap_or("").to_string();
                self.cookie = Some(sid);
            }
        }

        Ok(())
    }

    async fn version_is_v5(&self) -> Result<bool, AppError> {
        let url = format!("{}/api/v2/app/version", self.base_url);
        let resp = self.client.get(&url).send().await?;
        resp.error_for_status_ref()?;
        let v = resp.text().await?;
        let ver = v.trim().trim_start_matches('v');
        let major = ver
            .split('.')
            .next()
            .unwrap_or("0")
            .parse::<u32>()
            .unwrap_or(0);
        Ok(major >= 5)
    }

    fn request(&self, method: reqwest::Method, path: &str) -> reqwest::RequestBuilder {
        let url = format!("{}{}", self.base_url, path);
        let mut builder = self.client.request(method, &url);
        if let Some(c) = &self.cookie {
            builder = builder.header(COOKIE, c);
        }
        let referer = self.base_url.clone();
        builder = builder.header(ORIGIN, &referer);
        builder = builder.header(REFERER, &referer);
        builder
    }

    pub async fn add_torrent(&self, torrent_data: Vec<u8>) -> Result<(), AppError> {
        let part = multipart::Part::bytes(torrent_data)
            .file_name("torrent")
            .mime_str("application/x-bittorrent")
            .map_err(|e| AppError::Any(e.to_string()))?;

        let form = multipart::Form::new().part("torrents", part);

        let resp = self
            .request(reqwest::Method::POST, "/api/v2/torrents/add")
            .multipart(form)
            .send()
            .await?;

        resp.error_for_status_ref()?;
        Ok(())
    }

    pub async fn get_torrents_info(
        &self,
        hashes: Vec<String>,
    ) -> Result<Vec<TorrentInfo>, AppError> {
        let hashes_str = hashes.join("|");
        let resp = self
            .request(reqwest::Method::GET, "/api/v2/torrents/info")
            .query(&[("hashes", hashes_str)])
            .send()
            .await?;
        resp.error_for_status_ref()?;
        let infos: Vec<TorrentInfo> = resp.json().await?;
        Ok(infos)
    }

    pub async fn pause(&self, hash: &str) -> Result<(), AppError> {
        let is_v5 = self.version_is_v5().await?;
        let resp = if is_v5 {
            self.request(reqwest::Method::POST, "/api/v2/torrents/stop")
                .form(&[("hashes", hash)])
                .send()
                .await?
        } else {
            self.request(reqwest::Method::GET, "/api/v2/torrents/pause")
                .query(&[("hashes", hash)])
                .send()
                .await?
        };
        resp.error_for_status_ref()?;
        Ok(())
    }

    pub async fn resume(&self, hash: &str) -> Result<(), AppError> {
        let is_v5 = self.version_is_v5().await?;
        let resp = if is_v5 {
            self.request(reqwest::Method::POST, "/api/v2/torrents/start")
                .form(&[("hashes", hash)])
                .send()
                .await?
        } else {
            self.request(reqwest::Method::GET, "/api/v2/torrents/resume")
                .query(&[("hashes", hash)])
                .send()
                .await?
        };
        resp.error_for_status_ref()?;
        Ok(())
    }

    pub async fn delete(&self, hash: &str, delete_files: bool) -> Result<(), AppError> {
        let resp = self
            .request(reqwest::Method::POST, "/api/v2/torrents/delete")
            .form(&[
                ("hashes", hash.to_string()),
                (
                    "deleteFiles",
                    if delete_files {
                        String::from("true")
                    } else {
                        String::from("false")
                    },
                ),
            ])
            .send()
            .await?;
        resp.error_for_status_ref()?;
        Ok(())
    }
}
