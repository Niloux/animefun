//! src-tauri/src/services/bangumi_service.rs

use crate::error::AppError;
use crate::models::bangumi::{CalendarResponse, SearchResponse, SubjectResponse};

const BGM_API_HOST: &str = "https://api.bgm.tv";

pub async fn fetch_calendar() -> Result<Vec<CalendarResponse>, AppError> {
    let url = format!("{}/calendar", BGM_API_HOST);
    let client = reqwest::Client::builder()
        .user_agent("animefun/0.1")
        .gzip(true)
        .deflate(true)
        .build()?;
    let response = client
        .get(&url)
        .send()
        .await?
        .error_for_status()? // 返回非 2xx 时直接报错，而不是尝试解码错误体
        .json::<Vec<CalendarResponse>>()
        .await?;
    Ok(response)
}

pub async fn fetch_subject(id: u32) -> Result<SubjectResponse, AppError> {
    let url = format!("{}/v0/subjects/{}", BGM_API_HOST, id);
    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert(
        reqwest::header::ACCEPT_ENCODING,
        reqwest::header::HeaderValue::from_static("gzip, deflate"),
    );
    let client = reqwest::Client::builder()
        .user_agent("animefun/0.1")
        .default_headers(headers)
        .gzip(true)
        .deflate(true)
        .build()?;
    let response = client
        .get(&url)
        .send()
        .await?
        .error_for_status()? // 如果是 4xx/5xx，避免出现“error decoding response body”误报
        .json::<SubjectResponse>()
        .await?;
    Ok(response)
}

pub async fn search_subject(
    keywords: &str,
    subject_type: Option<Vec<u8>>,
    sort: Option<String>,
    tag: Option<Vec<String>>,
    air_date: Option<Vec<String>>,
    rating: Option<Vec<String>>,
    rating_count: Option<Vec<String>>,
    rank: Option<Vec<String>>,
    nsfw: Option<bool>,
    limit: Option<u32>,
    offset: Option<u32>,
) -> Result<SearchResponse, AppError> {
    let url = format!("{}/v0/search/subjects", BGM_API_HOST);
    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert(
        reqwest::header::ACCEPT_ENCODING,
        reqwest::header::HeaderValue::from_static("gzip, deflate"),
    );
    let client = reqwest::Client::builder()
        .user_agent("animefun/0.1")
        .default_headers(headers)
        .gzip(true)
        .deflate(true)
        .build()?;
    let mut req = client.post(&url);
    if let Some(l) = limit {
        req = req.query(&[("limit", l)]);
    }
    if let Some(o) = offset {
        req = req.query(&[("offset", o)]);
    }
    #[derive(serde::Serialize)]
    struct FilterPayload {
        #[serde(skip_serializing_if = "Option::is_none")]
        r#type: Option<Vec<u8>>,
        #[serde(skip_serializing_if = "Option::is_none")]
        tag: Option<Vec<String>>,
        #[serde(skip_serializing_if = "Option::is_none")]
        air_date: Option<Vec<String>>,
        #[serde(skip_serializing_if = "Option::is_none")]
        rating: Option<Vec<String>>,
        #[serde(skip_serializing_if = "Option::is_none")]
        rating_count: Option<Vec<String>>,
        #[serde(skip_serializing_if = "Option::is_none")]
        rank: Option<Vec<String>>,
        #[serde(skip_serializing_if = "Option::is_none")]
        nsfw: Option<bool>,
    }
    #[derive(serde::Serialize)]
    struct SearchPayload {
        keyword: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        sort: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        filter: Option<FilterPayload>,
    }
    let payload = SearchPayload {
        keyword: keywords.to_string(),
        sort,
        filter: Some(FilterPayload {
            r#type: subject_type,
            tag,
            air_date,
            rating,
            rating_count,
            rank,
            nsfw,
        }),
    };
    let response = req
        .json(&payload)
        .send()
        .await?
        .json::<SearchResponse>()
        .await?;
    Ok(response)
}

pub async fn fetch_episodes(
    subject_id: u32,
    ep_type: Option<u8>,
    limit: Option<u32>,
    offset: Option<u32>,
) -> Result<crate::models::bangumi::PagedEpisode, AppError> {
    let url = format!("{}/v0/episodes", BGM_API_HOST);
    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert(
        reqwest::header::ACCEPT_ENCODING,
        reqwest::header::HeaderValue::from_static("gzip, deflate"),
    );
    let client = reqwest::Client::builder()
        .user_agent("animefun/0.1")
        .default_headers(headers)
        .gzip(true)
        .deflate(true)
        .build()?;
    let mut req = client.get(&url).query(&[("subject_id", subject_id)]);
    if let Some(t) = ep_type {
        req = req.query(&[("type", t as u32)]);
    }
    if let Some(l) = limit {
        req = req.query(&[("limit", l)]);
    }
    if let Some(o) = offset {
        req = req.query(&[("offset", o)]);
    }
    let response = req
        .send()
        .await?
        .error_for_status()? // 统一错误处理
        .json::<crate::models::bangumi::PagedEpisode>()
        .await?;
    Ok(response)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_fetch_subject() {
        // 使用已确认存在的条目 ID 以避免 404 造成的误报
        let res = fetch_subject(12381).await.unwrap();
        assert_eq!(res.id, 12381);
        assert!(!res.name.is_empty());
    }

    #[tokio::test]
    async fn test_search_subject() {
        let res = search_subject("Fate", Some(vec![2]), None, None, None, None, None, None, None, Some(10), Some(0))
            .await
            .unwrap();
        assert!(res.total > 0);
        assert!(!res.data.is_empty());
        let first = &res.data[0];
        assert!(first.id > 0);
        assert!(!first.name.is_empty());
    }

    #[tokio::test]
    async fn test_fetch_episodes() {
        let res = fetch_episodes(876, None, Some(100), Some(0)).await.unwrap();
        assert!(res.limit >= 1);
        assert!(res.data.len() as u32 <= res.limit);
    }
}
