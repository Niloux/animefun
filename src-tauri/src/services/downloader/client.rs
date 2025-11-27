use crate::error::AppError;
use reqwest::Client;
use serde::{Deserialize, Serialize};

const BASE_URL: &str = "http://127.0.0.1:3030";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RqbitTorrentDetails {
    pub id: Option<usize>,
    pub info_hash: String,
    pub name: Option<String>,
    // Rqbit specific fields - adjusting based on likely API
    pub progress: Option<f64>,
    pub total_bytes: Option<u64>,
    pub finished_bytes: Option<u64>,
    pub state: Option<String>, // "live", "paused", "error"
    pub download_speed: Option<f64>,
    pub upload_speed: Option<f64>,
    pub output_folder: Option<String>,
}

#[derive(Debug, Serialize)]
struct AddTorrentRequest {
    url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    output_folder: Option<String>,
}

#[derive(Clone)]
pub struct RqbitClient {
    client: Client,
}

impl RqbitClient {
    pub fn new() -> Self {
        Self {
            client: crate::infra::http::CLIENT_LOCAL.clone(),
        }
    }

    pub async fn add_magnet(
        &self,
        magnet: &str,
        save_path: Option<&str>,
    ) -> Result<RqbitTorrentDetails, AppError> {
        let req = AddTorrentRequest {
            url: magnet.to_string(),
            output_folder: save_path.map(|s| s.to_string()),
        };

        let res = self
            .client
            .post(format!("{}/torrents", BASE_URL))
            .json(&req)
            .send()
            .await?;

        if !res.status().is_success() {
            return Err(AppError::Reqwest(res.error_for_status().unwrap_err()));
        }

        let details = res.json::<RqbitTorrentDetails>().await?;
        Ok(details)
    }

    pub async fn list(&self) -> Result<Vec<RqbitTorrentDetails>, AppError> {
        let res = self
            .client
            .get(format!("{}/torrents", BASE_URL))
            .send()
            .await?;

        #[derive(Deserialize)]
        struct ListResponse {
            torrents: Vec<RqbitTorrentDetails>,
        }

        let text = res.text().await?;
        // Try parsing as wrapper first
        if let Ok(wrapper) = serde_json::from_str::<ListResponse>(&text) {
            return Ok(wrapper.torrents);
        }
        // Fallback to array
        let list = serde_json::from_str::<Vec<RqbitTorrentDetails>>(&text)?;
        Ok(list)
    }

    pub async fn pause(&self, id_or_hash: &str) -> Result<(), AppError> {
        self.client
            .post(format!("{}/torrents/{}/pause", BASE_URL, id_or_hash))
            .send()
            .await?
            .error_for_status()?;
        Ok(())
    }

    pub async fn resume(&self, id_or_hash: &str) -> Result<(), AppError> {
        self.client
            .post(format!("{}/torrents/{}/start", BASE_URL, id_or_hash))
            .send()
            .await?
            .error_for_status()?;
        Ok(())
    }

    pub async fn delete(&self, id_or_hash: &str, delete_files: bool) -> Result<(), AppError> {
        let url = format!(
            "{}/torrents/{}?delete_files={}",
            BASE_URL, id_or_hash, delete_files
        );
        self.client.delete(url).send().await?.error_for_status()?;
        Ok(())
    }

    pub async fn get(&self, id_or_hash: &str) -> Result<RqbitTorrentDetails, AppError> {
        let res = self
            .client
            .get(format!("{}/torrents/{}", BASE_URL, id_or_hash))
            .send()
            .await?;

        let details = res.json::<RqbitTorrentDetails>().await?;
        Ok(details)
    }
}
