use serde::{Deserialize, Deserializer, Serialize};
use std::collections::HashMap;
use serde_json::Value;

// 辅助函数：递归收集 serde_json::Value 中的字符串
fn collect_strings_from_value(v: &Value, out: &mut Vec<String>) {
    match v {
        Value::String(s) => out.push(s.clone()),
        Value::Array(arr) => {
            for item in arr {
                collect_strings_from_value(item, out);
            }
        }
        Value::Object(map) => {
            // 特例：形如 `{"v": "some_value"}` 的对象
            if let Some(inner) = map.get("v") {
                collect_strings_from_value(inner, out);
            } else {
                // 其他对象的通用回退，可能不够理想
                for (_, val) in map.iter() {
                    collect_strings_from_value(val, out);
                }
            }
        }
        // 对于数字、布尔等类型，转换为字符串
        other => {
            let s = other.to_string();
            if !s.is_empty() && s != "null" {
                out.push(s.trim_matches('"').to_string());
            }
        }
    }
}

// 'infobox' 字段的自定义反序列化器
fn deserialize_infobox<'de, D>(deserializer: D) -> Result<Option<Vec<InfoItem>>, D::Error>
where
    D: Deserializer<'de>,
{
    let v: Option<Value> = Option::deserialize(deserializer)?;
    match v {
        Some(Value::Array(arr)) => {
            let mut items: Vec<InfoItem> = Vec::new();
            for it in arr {
                if let Value::Object(map) = it {
                    let key = map.get("key").and_then(|k| k.as_str()).unwrap_or("").to_string();
                    if key.is_empty() {
                        continue;
                    }
                    let val = map.get("value").unwrap_or(&Value::Null);
                    let mut parts: Vec<String> = Vec::new();
                    collect_strings_from_value(val, &mut parts);
                    let value = parts
                        .into_iter()
                        .filter(|s| !s.is_empty())
                        .collect::<Vec<_>>()
                        .join("、");
                    items.push(InfoItem { key, value });
                }
            }
            Ok(Some(items))
        }
        _ => Ok(None),
    }
}


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
    pub platform: Option<String>,
    pub images: Images,
    #[serde(default, deserialize_with = "deserialize_infobox")]
    pub infobox: Option<Vec<InfoItem>>,
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

#[derive(Debug, Serialize, Deserialize)]
pub struct Episode {
    pub id: u32,
    #[serde(rename = "type")]
    pub item_type: u8,
    pub name: String,
    pub name_cn: String,
    pub sort: f32,
    pub ep: Option<f32>,
    pub airdate: String,
    pub comment: u32,
    pub duration: String,
    pub desc: String,
    pub disc: u32,
    pub duration_seconds: Option<u32>,
    #[serde(default)]
    pub subject_id: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PagedEpisode {
    pub total: u32,
    pub limit: u32,
    pub offset: u32,
    pub data: Vec<Episode>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct InfoItem {
    pub key: String,
    pub value: String,
}
