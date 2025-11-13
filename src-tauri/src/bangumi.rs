use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION};
use serde::{Deserialize, Serialize};
use thiserror::Error;

// 自定义错误类型
#[derive(Error, Debug)]
pub enum BangumiError {
    #[error("Reqwest error: {0}")]
    Reqwest(#[from] reqwest::Error),

    #[error("URL parse error: {0}")]
    UrlParse(#[from] url::ParseError),

    #[error("JSON parse error: {0}")]
    JsonParse(#[from] serde_json::Error),

    #[error("API error: {0}")]
    Api(String),

    #[error("Unexpected response format")]
    UnexpectedResponse,
}

// 实现 Tauri 命令支持的错误转换
}

// 实现 From<BangumiError> for String
impl From<BangumiError> for String {
    fn from(err: BangumiError) -> Self {
        format!("{:?}", err)
}

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
    pub fn new(token: Option<String>) -> Result<Self, BangumiError> {
        let client = reqwest::Client::builder()
            .user_agent("animefun/0.1")
            .timeout(std::time::Duration::from_secs(30))
            .build()?;

        Ok(Self {
            client,
            base_url: "https://api.bgm.tv".to_string(),
            token,
        })

    fn build_headers(&self) -> HeaderMap {
        let mut headers = HeaderMap::new();

        if let Some(token) = &self.token {
            headers.insert(
                AUTHORIZATION,
                HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
            );
        }

        headers

    // 获取每日放送日历
    pub async fn get_calendar(&self) -> Result<DailyCalendar, BangumiError> {
        let url = format!("{}/calendar", self.base_url);

        Ok(self.client
            .get(url)
            .headers(self.build_headers())
            .send()
            .await?
            .json::<DailyCalendar>()
            .await?)

    // 获取番剧详情
    pub async fn get_subject(&self, id: u32) -> Result<SubjectDetail, BangumiError> {
        let url = format!("{}/v0/subjects/{}", self.base_url, id);

        Ok(self.client
            .get(url)
            .headers(self.build_headers())
            .send()
            .await?
            .json::<SubjectDetail>()
            .await?)

    // 搜索番剧
    pub async fn search_subjects(
        &self,
        keyword: &str,
        subject_type: Option<u8>,
        limit: Option<u32>,
        offset: Option<u32>,
    ) -> Result<SearchResult, BangumiError> {
        let url = format!("{}/v0/search/subjects", self.base_url);

        let query = let query = vec![vec![
            ("q", keyword),
            subject_type.map(|t| ("type", t.to_string().as_str())),
            limit.map(|l| ("limit", l.to_string().as_str())),
            offset.map(|o| ("offset", o.to_string().as_str())),
        ];

        // 过滤掉 None 值的参数
        let query: Vec<_> = query.into_iter().flatten().collect();

        Ok(self.client
            .get(url)
            .query(&query)
            .headers(self.build_headers())
            .send()
            .await?
            .json::<SearchResult>()
            .await?)

    // 获取番剧剧集列表
    pub async fn get_episodes(
        &self,
        subject_id: u32,
        limit: Option<u32>,
        offset: Option<u32>,
    ) -> Result<EpisodesResult, BangumiError> {
        let url = format!("{}/v0/episodes", self.base_url);

        let query = let query = vec![vec![
            ("subject_id", subject_id.to_string().as_str()subject_id.to_string()),
            limit.map(|l| ("limit", l.to_string().as_str())),
            offset.map(|o| ("offset", o.to_string().as_str())),
        ];

        // 过滤掉 None 值的参数
        let query: Vec<_> = query.into_iter().flatten().collect();

        Ok(self.client
            .get(url)
            .query(&query)
            .headers(self.build_headers())
            .send()
            .await?
            .json::<EpisodesResult>()
            .await?)
}
