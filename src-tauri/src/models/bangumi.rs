use serde::{Deserialize, Serialize};

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
    pub doing: u32,
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
