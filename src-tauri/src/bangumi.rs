use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION};
use serde::{Deserialize, Serialize};
use urlencoding;

// 与前端完全匹配的类型定义

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Weekday {
    pub en: String,
    pub cn: String,
    pub ja: String,
    pub id: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Rating {
    pub total: u32,
    pub count: std::collections::HashMap<String, u32>,
    pub score: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Images {
    pub large: String,
    pub common: String,
    pub medium: String,
    pub small: String,
    pub grid: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Collection {
    pub doing: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Anime {
    pub id: u32,
    pub url: String,
    #[serde(rename = "type")]
    pub r#type: u8,
    pub name: String,
    pub name_cn: String,
    pub summary: String,
    pub air_date: String,
    pub air_weekday: u32,
    pub rating: Rating,
    pub rank: Option<u32>,
    pub images: Images,
    pub collection: Option<Collection>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalendarDay {
    pub weekday: Weekday,
    pub items: Vec<Anime>,
}

pub type DailyCalendar = Vec<CalendarDay>;

// 详情页数据结构
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubjectDetail {
    pub id: u32,
    pub url: String,
    #[serde(rename = "type")]
    pub r#type: u8,
    pub name: String,
    pub name_cn: String,
    pub summary: String,
    pub images: Images,
    #[serde(rename = "date")]
    pub air_date: String,
    pub platform: String,
    pub rating: Rating,
    pub total_episodes: u32,
    pub collection: Collection,
    pub rank: Option<u32>,
}

// 搜索结果数据结构
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchSubject {
    pub id: u32,
    #[serde(rename = "type")]
    pub r#type: u8,
    pub name: String,
    pub name_cn: String,
    pub summary: String,
    pub images: Images,
    pub rating: Option<Rating>,
    #[serde(rename = "air_date", default)]
    pub air_date: String,
    #[serde(rename = "total_episodes", default)]
    pub total_episodes: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub total: u32,
    pub limit: u32,
    pub offset: u32,
    pub data: Vec<SearchSubject>,
}

// 剧集数据结构
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Episode {
    pub id: u32,
    pub name: String,
    pub name_cn: String,
    pub ep: Option<f32>,
    pub airdate: Option<String>,
    pub duration: Option<String>,
    #[serde(rename = "type")]
    pub r#type: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EpisodesResult {
    pub total: u32,
    pub limit: u32,
    pub offset: u32,
    pub data: Vec<Episode>,
}

// Bangumi API 客户端
pub struct BangumiClient {
    client: reqwest::Client,
    base_url: String,
    token: Option<String>,
}

impl BangumiClient {
    pub fn new(token: Option<String>) -> Self {
        let client = reqwest::Client::builder()
            .user_agent("animefun/0.1")
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .unwrap();

        Self {
            client,
            base_url: "https://api.bgm.tv".to_string(),
            token,
        }
    }

    fn build_headers(&self) -> HeaderMap {
        let mut headers = HeaderMap::new();

        if let Some(token) = &self.token {
            headers.insert(
                AUTHORIZATION,
                HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
            );
        }

        headers
    }

    // 获取每日放送日历
    pub async fn get_calendar(&self) -> Result<DailyCalendar, String> {
        let url = format!("{}/calendar", self.base_url);

        self.client
            .get(url)
            .headers(self.build_headers())
            .send()
            .await
            .map_err(|e| e.to_string())?
            .json::<DailyCalendar>()
            .await
            .map_err(|e| e.to_string())
    }

    // 获取番剧详情
    pub async fn get_subject(&self, id: u32) -> Result<SubjectDetail, String> {
        let url = format!("{}/v0/subjects/{}", self.base_url, id);

        self.client
            .get(url)
            .headers(self.build_headers())
            .send()
            .await
            .map_err(|e| e.to_string())?
            .json::<SubjectDetail>()
            .await
            .map_err(|e| e.to_string())
    }

    // 搜索番剧
    pub async fn search_subjects(
        &self,
        keyword: &str,
        subject_type: Option<u8>,
        limit: Option<u32>,
        offset: Option<u32>,
    ) -> Result<SearchResult, String> {
        // 使用字符串拼接构建完整 URL
        let mut url = format!(
            "{}/v0/search/subjects?q={}",
            self.base_url,
            urlencoding::encode(keyword)
        );

        if let Some(t) = subject_type {
            url.push_str(&format!("&type={}", t));
        }

        if let Some(l) = limit {
            url.push_str(&format!("&limit={}", l));
        }

        if let Some(o) = offset {
            url.push_str(&format!("&offset={}", o));
        }

        self.client
            .get(url)
            .headers(self.build_headers())
            .send()
            .await
            .map_err(|e| e.to_string())?
            .json::<SearchResult>()
            .await
            .map_err(|e| e.to_string())
    }

    // 获取番剧剧集列表
    pub async fn get_episodes(
        &self,
        subject_id: u32,
        limit: Option<u32>,
        offset: Option<u32>,
    ) -> Result<EpisodesResult, String> {
        // 使用字符串拼接构建完整 URL
        let mut url = format!("{}/v0/episodes?subject_id={}", self.base_url, subject_id);

        if let Some(l) = limit {
            url.push_str(&format!("&limit={}", l));
        }

        if let Some(o) = offset {
            url.push_str(&format!("&offset={}", o));
        }

        self.client
            .get(url)
            .headers(self.build_headers())
            .send()
            .await
            .map_err(|e| e.to_string())?
            .json::<EpisodesResult>()
            .await
            .map_err(|e| e.to_string())
    }
}
