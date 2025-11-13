//! src-tauri/src/services/bangumi_service.rs

use crate::error::AppError;
use crate::models::bangumi::{CalendarResponse, SearchResponse, SubjectResponse};

const BGM_API_HOST: &str = "https://api.bgm.tv";

pub async fn fetch_calendar() -> Result<Vec<CalendarResponse>, AppError> {
    let url = format!("{}/calendar", BGM_API_HOST);
    let response = reqwest::get(&url)
        .await?
        .json::<Vec<CalendarResponse>>()
        .await?;
    Ok(response)
}

pub async fn fetch_subject(id: u32) -> Result<SubjectResponse, AppError> {
    let url = format!("{}/v0/subjects/{}", BGM_API_HOST, id);
    let response = reqwest::get(&url)
        .await?
        .json::<SubjectResponse>()
        .await?;
    Ok(response)
}

pub async fn search_subject(keywords: &str, subject_type: Option<u8>, limit: Option<u32>, offset: Option<u32>) -> Result<SearchResponse, AppError> {
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
        sort: None,
        filter: subject_type.map(|t| FilterPayload { r#type: Some(vec![t]) }),
    };
    let response = req
        .json(&payload)
        .send()
        .await?
        .json::<SearchResponse>()
        .await?;
    Ok(response)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_fetch_subject() {
        let res = fetch_subject(12).await.unwrap();
        assert_eq!(res.id, 12);
        assert!(!res.name.is_empty());
    }

    #[tokio::test]
    async fn test_search_subject() {
        let res = search_subject("Fate", Some(2), Some(10), Some(0)).await.unwrap();
        assert!(res.total > 0);
        assert!(!res.data.is_empty());
        let first = &res.data[0];
        assert!(first.id > 0);
        assert!(!first.name.is_empty());
    }
}
