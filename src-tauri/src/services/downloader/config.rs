use crate::error::AppError;
use crate::infra::path::default_app_dir;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use tokio::fs;
use tokio::sync::Notify;
use ts_rs::TS;

pub static CONFIG_CHANGED: Lazy<Notify> = Lazy::new(Notify::const_new);

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/types/gen/downloader_config.ts")]
pub struct DownloaderConfig {
    pub api_url: String,
    pub username: Option<String>,
    pub password: Option<String>,
}

impl Default for DownloaderConfig {
    fn default() -> Self {
        Self {
            api_url: "http://localhost:8080".to_string(),
            username: Some("admin".to_string()),
            password: Some("adminadmin".to_string()),
        }
    }
}

pub async fn get_config() -> Result<DownloaderConfig, AppError> {
    let path = default_app_dir().join("downloader.json");
    if !path.exists() {
        return Ok(DownloaderConfig::default());
    }
    let content = fs::read_to_string(path).await?;
    let config = serde_json::from_str(&content).unwrap_or_default();
    Ok(config)
}

pub async fn save_config(config: DownloaderConfig) -> Result<(), AppError> {
    let dir = default_app_dir();
    if !dir.exists() {
        fs::create_dir_all(&dir).await?;
    }
    let path = dir.join("downloader.json");
    let content = serde_json::to_string_pretty(&config)?;
    fs::write(path, content).await?;
    CONFIG_CHANGED.notify_waiters();
    Ok(())
}
