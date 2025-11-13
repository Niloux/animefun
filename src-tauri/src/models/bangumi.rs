use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize)]
pub struct Weekday {
    pub en: String,
    pub cn: String,
    pub ja: String,
    pub id: u8,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Rating {
    pub total: u32,
    pub score: f32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Images {
    pub large: String,
    pub common: String,
    pub medium: String,
    pub small: String,
    pub grid: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Collection {
    pub wish: Option<u32>,
    pub collect: Option<u32>,
    pub doing: Option<u32>,
    pub on_hold: Option<u32>,
    pub dropped: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CalendarItem {
    pub id: u32,
    pub url: String,
    #[serde(rename = "type")]
    pub item_type: u8,
    pub name: String,
    pub name_cn: String,
    pub summary: String,
    pub air_date: String,
    pub air_weekday: u8,
    pub rating: Option<Rating>,
    pub rank: Option<u32>,
    pub images: Option<Images>,
    pub collection: Option<Collection>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CalendarResponse {
    pub weekday: Weekday,
    pub items: Vec<CalendarItem>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SubjectResponse {
    pub id: u32,
    pub url: Option<String>,
    #[serde(rename = "type")]
    pub item_type: u8,
    pub name: String,
    pub name_cn: String,
    pub summary: String,
    pub series: Option<bool>,
    pub nsfw: bool,
    pub locked: bool,
    pub date: Option<String>,
    pub platform: String,
    pub images: Images,
    pub infobox: Option<serde_json::Value>,
    pub volumes: Option<u32>,
    pub eps: Option<u32>,
    pub total_episodes: Option<u32>,
    pub rating: Option<SubjectRating>,
    pub collection: Option<SubjectCollection>,
    pub meta_tags: Option<Vec<String>>,
    pub tags: Option<Vec<SubjectTag>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SubjectTag {
    pub name: String,
    pub count: u32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SubjectRating {
    pub rank: Option<u32>,
    pub total: u32,
    pub count: HashMap<String, u32>,
    pub score: f32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SubjectCollection {
    pub wish: u32,
    pub collect: u32,
    pub doing: u32,
    pub on_hold: u32,
    pub dropped: u32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResponse {
    pub total: u32,
    pub limit: u32,
    pub offset: u32,
    pub data: Vec<SubjectResponse>,
}
