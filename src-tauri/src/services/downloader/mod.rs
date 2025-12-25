pub mod client;
pub mod config;
pub mod monitor;
pub mod repo;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Serialize, Clone, TS)]
#[ts(export, export_to = "../../../src/types/gen/downloader.ts")]
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

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Metadata {
    pub resource_title: String,
    pub cover_url: String,
}

pub fn parse_metadata(meta_str: &str) -> Option<(String, String)> {
    let meta: Metadata = serde_json::from_str(meta_str).ok()?;
    if meta.resource_title.is_empty() || meta.cover_url.is_empty() {
        return None;
    }
    Some((meta.resource_title, meta.cover_url))
}

pub fn build_metadata(title: String, cover: String) -> String {
    serde_json::json!({
        "resource_title": title,
        "cover_url": cover
    })
    .to_string()
}
