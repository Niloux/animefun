pub mod client;
pub mod config;
pub mod monitor;
pub mod repo;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Serialize, Clone, TS)]
#[ts(export, export_to = "../../src/types/gen/downloader.ts")]
pub struct DownloadItem {
    pub hash: String,
    pub subject_id: u32,
    pub episode: Option<u32>,
    #[ts(optional)]
    pub episode_range: Option<String>,
    #[ts(optional)]
    pub resolution: Option<u32>,
    pub status: String,
    pub progress: f64,
    pub dlspeed: i64,
    pub eta: i64,
    pub title: String,
    pub cover: String,
    #[ts(optional)]
    pub meta_json: Option<String>,
    #[ts(optional)]
    pub save_path: Option<String>,
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


/// Extract resolution from live torrent name or parsed title.
/// Prioritizes the live torrent name, falls back to title.
pub fn extract_resolution(live_name: Option<&str>, title: &str) -> Option<u32> {
    use crate::utils::parser::parse_resolution;

    live_name
        .and_then(|n| parse_resolution(n))
        .or_else(|| parse_resolution(title))
}

pub fn build_metadata(title: String, cover: String) -> String {
    serde_json::json!({
        "resource_title": title,
        "cover_url": cover
    })
    .to_string()
}
