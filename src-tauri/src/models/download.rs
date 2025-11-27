use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct DownloadTask {
    pub id: i64,
    pub anime_id: i64,
    pub episode_id: i64,
    pub info_hash: String,
    pub magnet_url: String,
    pub save_path: String,
    pub status: String,
    pub metadata: String,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct DownloadTaskMetadata {
    pub anime_title: String,
    pub episode_title: String,
    pub image_url: Option<String>,
}
