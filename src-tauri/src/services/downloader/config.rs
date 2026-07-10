use crate::error::AppError;
use crate::infra::path::default_app_dir;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::path::Path;
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
    load_config(&default_app_dir().join("downloader.json")).await
}

async fn load_config(path: &Path) -> Result<DownloaderConfig, AppError> {
    match fs::read_to_string(path).await {
        Ok(content) => Ok(serde_json::from_str(&content)?),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            Ok(DownloaderConfig::default())
        }
        Err(error) => Err(error.into()),
    }
}

pub async fn save_config(config: DownloaderConfig) -> Result<(), AppError> {
    save_config_to(&default_app_dir().join("downloader.json"), &config).await?;
    CONFIG_CHANGED.notify_waiters();
    Ok(())
}

async fn save_config_to(path: &Path, config: &DownloaderConfig) -> Result<(), AppError> {
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).await?;
    }
    let temp_path = path.with_extension("tmp");
    let content = serde_json::to_string_pretty(&config)?;
    fs::write(&temp_path, content).await?;
    if let Err(error) = fs::rename(&temp_path, path).await {
        let _ = fs::remove_file(temp_path).await;
        return Err(error.into());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn reports_corruption_and_replaces_it_atomically() {
        let dir = std::env::temp_dir().join(format!(
            "animefun-config-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let path = dir.join("downloader.json");
        fs::create_dir_all(&dir).await.unwrap();
        fs::write(&path, "{broken").await.unwrap();

        assert!(matches!(
            load_config(&path).await,
            Err(AppError::SerdeJson(_))
        ));
        assert_eq!(fs::read_to_string(&path).await.unwrap(), "{broken");

        let config = DownloaderConfig::default();
        save_config_to(&path, &config).await.unwrap();
        assert_eq!(load_config(&path).await.unwrap().api_url, config.api_url);
        assert!(!path.with_extension("tmp").exists());

        fs::remove_dir_all(dir).await.unwrap();
    }
}
