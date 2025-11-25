use serde::{Deserialize, Deserializer, Serialize};
use std::collections::HashMap;
use ts_rs::TS;

#[derive(Deserialize)]
#[serde(untagged)]
enum InfoValue {
    Text(String),
    VStr { v: String },
    VList { v: Vec<InfoValue> },
    List(Vec<InfoValue>),
}

#[derive(Deserialize)]
struct InfoItemRaw {
    key: String,
    #[serde(default)]
    value: Option<InfoValue>,
}

fn collect_strings(v: &InfoValue, out: &mut Vec<String>) {
    match v {
        InfoValue::Text(s) => out.push(s.clone()),
        InfoValue::VStr { v } => out.push(v.clone()),
        InfoValue::VList { v } => {
            for x in v {
                collect_strings(x, out);
            }
        }
        InfoValue::List(xs) => {
            for x in xs {
                collect_strings(x, out);
            }
        }
    }
}

fn deserialize_infobox<'de, D>(deserializer: D) -> Result<Option<Vec<InfoItem>>, D::Error>
where
    D: Deserializer<'de>,
{
    let raw: Option<Vec<InfoItemRaw>> = Option::deserialize(deserializer)?;
    if let Some(items) = raw {
        let mut out: Vec<InfoItem> = Vec::with_capacity(items.len());
        for it in items {
            if it.key.is_empty() {
                continue;
            }
            let mut parts: Vec<String> = Vec::new();
            if let Some(v) = it.value.as_ref() {
                collect_strings(v, &mut parts);
            }
            let values: Vec<String> = parts
                .into_iter()
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect();
            out.push(InfoItem {
                key: it.key,
                values,
            });
        }
        Ok(Some(out))
    } else {
        Ok(None)
    }
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/types/gen/bangumi.ts")]
pub struct Weekday {
    pub en: String,
    pub cn: String,
    pub ja: String,
    pub id: u8,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/types/gen/bangumi.ts")]
pub struct Rating {
    pub total: u32,
    pub score: f32,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/types/gen/bangumi.ts")]
pub struct Images {
    pub large: String,
    pub common: String,
    pub medium: String,
    pub small: String,
    pub grid: String,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/types/gen/bangumi.ts")]
#[ts(optional_fields)]
pub struct Collection {
    pub wish: Option<u32>,
    pub collect: Option<u32>,
    pub doing: Option<u32>,
    pub on_hold: Option<u32>,
    pub dropped: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/types/gen/bangumi.ts")]
#[ts(rename = "CalendarItem")]
#[ts(optional_fields)]
pub struct CalendarItem {
    pub id: u32,
    pub url: String,
    #[serde(rename = "type")]
    #[ts(rename = "type")]
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

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/types/gen/bangumi.ts")]
#[ts(rename = "CalendarDay")]
pub struct CalendarResponse {
    pub weekday: Weekday,
    pub items: Vec<CalendarItem>,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/types/gen/bangumi.ts")]
#[ts(rename = "Anime")]
#[ts(optional_fields)]
pub struct SubjectResponse {
    pub id: u32,
    pub url: Option<String>,
    #[serde(rename = "type")]
    #[ts(rename = "type")]
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

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/types/gen/bangumi.ts")]
pub struct SubjectTag {
    pub name: String,
    pub count: u32,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/types/gen/bangumi.ts")]
#[ts(optional_fields)]
pub struct SubjectRating {
    pub rank: Option<u32>,
    pub total: u32,
    pub count: HashMap<String, u32>,
    pub score: f32,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/types/gen/bangumi.ts")]
pub struct SubjectCollection {
    pub wish: u32,
    pub collect: u32,
    pub doing: u32,
    pub on_hold: u32,
    pub dropped: u32,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/types/gen/bangumi.ts")]
pub struct SearchResponse {
    pub total: u32,
    pub limit: u32,
    pub offset: u32,
    pub data: Vec<SubjectResponse>,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/types/gen/bangumi.ts")]
pub struct Episode {
    pub id: u32,
    #[serde(rename = "type")]
    #[ts(rename = "type")]
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
    #[ts(optional)]
    pub duration_seconds: Option<u32>,
    #[serde(default)]
    #[ts(optional)]
    pub subject_id: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/types/gen/bangumi.ts")]
pub struct PagedEpisode {
    pub total: u32,
    pub limit: u32,
    pub offset: u32,
    pub data: Vec<Episode>,
}

#[derive(Debug, Serialize, Deserialize, Clone, TS)]
#[ts(export, export_to = "../../src/types/gen/bangumi.ts")]
pub struct InfoItem {
    pub key: String,
    pub values: Vec<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::Deserialize;

    #[derive(Deserialize)]
    struct Wrap {
        #[serde(default, deserialize_with = "deserialize_infobox")]
        infobox: Option<Vec<InfoItem>>,
    }

    #[test]
    fn parse_simple_string_value() {
        let json = serde_json::json!({
            "infobox": [
                {"key":"中文名", "value":"你的名字。"}
            ]
        });
        let w: Wrap = serde_json::from_value(json).unwrap();
        let infobox = w.infobox.unwrap();
        assert_eq!(infobox[0].key, "中文名");
        assert_eq!(infobox[0].values, vec!["你的名字。".to_string()]);
    }

    #[test]
    fn parse_alias_v_list() {
        let json = serde_json::json!({
            "infobox": [
                {"key":"别名", "value":[{"v":"Kimi no Na wa."},{"v":"Your Name."}]}
            ]
        });
        let w: Wrap = serde_json::from_value(json).unwrap();
        let infobox = w.infobox.unwrap();
        assert_eq!(infobox[0].key, "别名");
        assert_eq!(
            infobox[0].values,
            vec!["Kimi no Na wa.".to_string(), "Your Name.".to_string(),]
        );
    }
}

#[derive(Debug, Serialize, Deserialize, TS, PartialEq)]
#[ts(export, export_to = "../../src/types/gen/bangumi.ts")]
pub enum SubjectStatusCode {
    PreAir,
    Airing,
    Finished,
    OnHiatus,
    Unknown,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/types/gen/bangumi.ts")]
pub struct SubjectStatus {
    pub code: SubjectStatusCode,
    #[ts(optional)]
    pub first_air_date: Option<String>,
    #[ts(optional)]
    pub latest_airdate: Option<String>,
    #[ts(optional)]
    pub expected_eps: Option<u32>,
    #[ts(optional)]
    pub current_eps: Option<u32>,
    pub calendar_on_air: bool,
    pub reason: String,
}
