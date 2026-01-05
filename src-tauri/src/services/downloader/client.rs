use super::config::DownloaderConfig;
use crate::error::AppError;
use once_cell::sync::Lazy;
use reqwest::header::{COOKIE, ORIGIN, REFERER};
use reqwest::multipart;
use serde::{Deserialize, Serialize};
use sha1::{Digest, Sha1};
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use tokio::sync::RwLock;
use ts_rs::TS;

// Video file extensions for identifying playable files
pub static VIDEO_EXTENSIONS: &[&str] = &[
    ".mkv", ".mp4", ".avi", ".wmv", ".webm",
    ".flv", ".m4v", ".mov", ".rm", ".rmvb",
    ".ts", ".mts", ".m2ts", ".3gp",
];

struct SessionState {
    cookie: String,
    config_hash: u64,
}

// Use RwLock for concurrent reads: multiple readers can access session simultaneously
static SESSION: Lazy<RwLock<Option<SessionState>>> = Lazy::new(|| RwLock::new(None));

pub struct QbitClient {
    base_url: String,
    cookie: Option<String>,
    config: DownloaderConfig,
}

#[derive(Deserialize, Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../../src/types/gen/torrent_info.ts")]
pub struct TorrentInfo {
    pub hash: String,
    pub name: String,
    pub state: String,
    pub progress: f64,
    pub dlspeed: i64, // 字节/秒
    pub eta: i64,     // 秒
    pub save_path: String,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TorrentFile {
    pub index: usize,
    pub name: String,
    pub size: i64,
    #[serde(default)]
    pub progress: f64,
    #[serde(default)]
    pub priority: i32,
    #[serde(default)]
    pub is_seed: bool,
    #[serde(default)]
    pub name_html: Option<String>,
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

fn calculate_config_hash(c: &DownloaderConfig) -> u64 {
    let mut s = DefaultHasher::new();
    c.api_url.hash(&mut s);
    c.username.hash(&mut s);
    c.password.hash(&mut s);
    s.finish()
}

impl QbitClient {
    pub fn new(config: DownloaderConfig) -> Self {
        Self {
            base_url: config.api_url.clone().trim_end_matches('/').to_string(),
            cookie: None,
            config,
        }
    }

    pub async fn get_app_version(&self) -> Result<String, AppError> {
        let resp = self
            .request(reqwest::Method::GET, "/api/v2/app/version")
            .send()
            .await?;
        resp.error_for_status_ref()?;
        let txt = resp.text().await?;
        Ok(txt)
    }

    pub async fn login(&mut self) -> Result<(), AppError> {
        let current_hash = calculate_config_hash(&self.config);

        // 1. Try to reuse existing global session (concurrent read)
        {
            let session = SESSION.read().await;
            if let Some(s) = &*session {
                if s.config_hash == current_hash {
                    self.cookie = Some(s.cookie.clone());
                    return Ok(());
                }
            }
        }

        // 2. Perform login
        let url = format!("{}/api/v2/auth/login", self.base_url);
        let params = [
            ("username", self.config.username.as_deref().unwrap_or("")),
            ("password", self.config.password.as_deref().unwrap_or("")),
        ];

        let resp = crate::infra::http::CLIENT
            .post(&url)
            .header(ORIGIN, &self.base_url)
            .header(REFERER, &self.base_url)
            .form(&params)
            .send()
            .await?;

        resp.error_for_status_ref()?;

        let mut cookie_val = String::new();
        if let Some(cookie) = resp.headers().get("set-cookie") {
            if let Ok(c) = cookie.to_str() {
                cookie_val = c.split(';').next().unwrap_or("").to_string();
                self.cookie = Some(cookie_val.clone());
            }
        }

        // 3. Update global session (exclusive write)
        if !cookie_val.is_empty() {
            let mut session = SESSION.write().await;
            *session = Some(SessionState {
                cookie: cookie_val,
                config_hash: current_hash,
            });
        }

        Ok(())
    }

    fn request(&self, method: reqwest::Method, path: &str) -> reqwest::RequestBuilder {
        let url = format!("{}{}", self.base_url, path);
        let mut builder = crate::infra::http::CLIENT.request(method, &url);
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
        let txt = resp.text().await?;
        if txt.trim() == "Ok." {
            Ok(())
        } else {
            Err(AppError::Any(format!("qbit_add: {}", txt)))
        }
    }

    pub async fn add_url(&self, url: &str) -> Result<(), AppError> {
        let resp = self
            .request(reqwest::Method::POST, "/api/v2/torrents/add")
            .form(&[("urls", url.to_string())])
            .send()
            .await?;
        resp.error_for_status_ref()?;
        let txt = resp.text().await?;
        if txt.trim() == "Ok." {
            Ok(())
        } else {
            Err(AppError::Any(format!("qbit_add: {}", txt)))
        }
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

    pub async fn pause(&mut self, hash: &str) -> Result<(), AppError> {
        let resp = self
            .request(reqwest::Method::POST, "/api/v2/torrents/stop")
            .form(&[("hashes", hash)])
            .send()
            .await?;
        resp.error_for_status_ref()?;
        Ok(())
    }

    pub async fn resume(&mut self, hash: &str) -> Result<(), AppError> {
        let resp = self
            .request(reqwest::Method::POST, "/api/v2/torrents/start")
            .form(&[("hashes", hash)])
            .send()
            .await?;
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

    pub async fn get_torrent_files(&self, hash: &str) -> Result<Vec<TorrentFile>, AppError> {
        let resp = self
            .request(reqwest::Method::GET, "/api/v2/torrents/files")
            .query(&[("hash", hash)])
            .send()
            .await?;
        resp.error_for_status_ref()?;
        let files: Vec<TorrentFile> = resp.json().await?;
        Ok(files)
    }
}

pub fn parse_magnet_btih(magnet: &str) -> Option<String> {
    let s = magnet;
    let p = s.find("btih:")?;
    let start = p + 5;
    let end = s[start..].find('&').map(|i| start + i).unwrap_or(s.len());
    let raw = &s[start..end];
    let r = raw.trim();
    let hex_candidate = r.chars().all(|c| c.is_ascii_hexdigit());
    if hex_candidate && r.len() == 40 {
        return Some(r.to_lowercase());
    }
    let up = r.to_uppercase();
    let bytes = base32_decode(&up)?;
    Some(
        bytes
            .iter()
            .map(|b| format!("{:02x}", b))
            .collect::<String>(),
    )
}

fn base32_decode(s: &str) -> Option<Vec<u8>> {
    let mut buf: u64 = 0;
    let mut bits: usize = 0;
    let mut out: Vec<u8> = Vec::new();
    for ch in s.chars() {
        let v: u8 = match ch {
            'A'..='Z' => (ch as u8) - b'A',
            '2'..='7' => (ch as u8) - b'2' + 26,
            '=' => continue,
            _ => return None,
        };
        buf = (buf << 5) | (v as u64);
        bits += 5;
        while bits >= 8 {
            bits -= 8;
            let byte = ((buf >> bits) & 0xFF) as u8;
            out.push(byte);
        }
    }
    Some(out)
}
