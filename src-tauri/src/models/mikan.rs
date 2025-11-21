use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/types/gen/mikan.ts")]
pub struct MikanResourceItem {
    pub title: String,
    pub page_url: String,
    #[ts(optional)]
    pub torrent_url: Option<String>,
    #[ts(optional)]
    pub magnet: Option<String>,
    #[ts(optional)]
    pub pub_date: Option<String>,
    #[ts(optional)]
    pub size_bytes: Option<u64>,
    #[ts(optional)]
    pub group: Option<String>,
    #[ts(optional)]
    pub episode: Option<u32>,
    #[ts(optional)]
    pub episode_range: Option<String>,
    #[ts(optional)]
    pub resolution: Option<u16>,
    #[ts(optional)]
    pub subtitle_lang: Option<String>,
    #[ts(optional)]
    pub subtitle_type: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/types/gen/mikan.ts")]
pub struct MikanResourcesResponse {
    pub mapped: bool,
    #[ts(optional)]
    pub mikan_bangumi_id: Option<u32>,
    pub items: Vec<MikanResourceItem>,
}
