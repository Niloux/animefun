//! src-tauri/src/services/bangumi_service.rs

use crate::error::AppError;
use crate::cache;
use crate::models::bangumi::{CalendarResponse, SearchResponse, SubjectResponse};
use once_cell::sync::Lazy;
use reqwest::StatusCode;
use reqwest::header::{IF_NONE_MATCH, IF_MODIFIED_SINCE, ETAG, LAST_MODIFIED};

const BGM_API_HOST: &str = "https://api.bgm.tv";

static CLIENT: Lazy<reqwest::Client> = Lazy::new(|| {
    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert(
        reqwest::header::ACCEPT_ENCODING,
        reqwest::header::HeaderValue::from_static("gzip, deflate"),
    );
    reqwest::Client::builder()
        .user_agent("animefun/0.1")
        .default_headers(headers)
        .gzip(true)
        .deflate(true)
        .build()
        .expect("client")
});

pub async fn fetch_calendar() -> Result<Vec<CalendarResponse>, AppError> {
    if let Some(v) = cache::get("calendar").await.ok().flatten() {
        if let Ok(parsed) = serde_json::from_str::<Vec<CalendarResponse>>(&v) {
            return Ok(parsed);
        }
    }
    let url = format!("{}/calendar", BGM_API_HOST);
    let client = &*CLIENT;
    let (etag, last_modified) = cache::get_meta("calendar").await.unwrap_or((None, None));
    let mut req = client.get(&url);
    if let Some(e) = etag.clone() { req = req.header(IF_NONE_MATCH, e); }
    if let Some(lm) = last_modified.clone() { req = req.header(IF_MODIFIED_SINCE, lm); }
    let resp = req.send().await?;
    if resp.status() == StatusCode::NOT_MODIFIED {
        if let Some(v) = cache::get("calendar").await.ok().flatten() {
            if let Ok(parsed) = serde_json::from_str::<Vec<CalendarResponse>>(&v) {
                return Ok(parsed);
            }
        }
        let fallback = client.get(&url).send().await?;
        let headers = fallback.headers().clone();
        fallback.error_for_status_ref()?;
        let data = fallback.json::<Vec<CalendarResponse>>().await?;
        if let Ok(s) = serde_json::to_string(&data) { let _ = cache::set("calendar", s, 6 * 3600).await; }
        let new_etag = headers.get(ETAG).and_then(|v| v.to_str().ok()).map(|s| s.to_string());
        let new_lm = headers.get(LAST_MODIFIED).and_then(|v| v.to_str().ok()).map(|s| s.to_string());
        let _ = cache::set_meta("calendar", new_etag, new_lm).await;
        return Ok(data);
    }
    let headers = resp.headers().clone();
    resp.error_for_status_ref()?;
    let data = resp.json::<Vec<CalendarResponse>>().await?;
    if let Ok(s) = serde_json::to_string(&data) { let _ = cache::set("calendar", s, 6 * 3600).await; }
    let new_etag = headers.get(ETAG).and_then(|v| v.to_str().ok()).map(|s| s.to_string());
    let new_lm = headers.get(LAST_MODIFIED).and_then(|v| v.to_str().ok()).map(|s| s.to_string());
    let _ = cache::set_meta("calendar", new_etag, new_lm).await;
    Ok(data)
}

pub async fn fetch_subject(id: u32) -> Result<SubjectResponse, AppError> {
    let key = format!("subject:{}", id);
    if let Some(v) = cache::get(&key).await.ok().flatten() {
        if let Ok(parsed) = serde_json::from_str::<SubjectResponse>(&v) {
            return Ok(parsed);
        }
    }
    let url = format!("{}/v0/subjects/{}", BGM_API_HOST, id);
    let client = &*CLIENT;
    let (etag, last_modified) = cache::get_meta(&key).await.unwrap_or((None, None));
    let mut req = client.get(&url);
    if let Some(e) = etag.clone() { req = req.header(IF_NONE_MATCH, e); }
    if let Some(lm) = last_modified.clone() { req = req.header(IF_MODIFIED_SINCE, lm); }
    let resp = req.send().await?;
    if resp.status() == StatusCode::NOT_MODIFIED {
        if let Some(v) = cache::get(&key).await.ok().flatten() {
            if let Ok(parsed) = serde_json::from_str::<SubjectResponse>(&v) {
                return Ok(parsed);
            }
        }
        let fallback = client.get(&url).send().await?;
        let headers = fallback.headers().clone();
        fallback.error_for_status_ref()?;
        let data = fallback.json::<SubjectResponse>().await?;
        if let Ok(s) = serde_json::to_string(&data) { let _ = cache::set(&key, s, 24 * 3600).await; }
        let new_etag = headers.get(ETAG).and_then(|v| v.to_str().ok()).map(|s| s.to_string());
        let new_lm = headers.get(LAST_MODIFIED).and_then(|v| v.to_str().ok()).map(|s| s.to_string());
        let _ = cache::set_meta(&key, new_etag, new_lm).await;
        return Ok(data);
    }
    let headers = resp.headers().clone();
    resp.error_for_status_ref()?;
    let data = resp.json::<SubjectResponse>().await?;
    if let Ok(s) = serde_json::to_string(&data) { let _ = cache::set(&key, s, 24 * 3600).await; }
    let new_etag = headers.get(ETAG).and_then(|v| v.to_str().ok()).map(|s| s.to_string());
    let new_lm = headers.get(LAST_MODIFIED).and_then(|v| v.to_str().ok()).map(|s| s.to_string());
    let _ = cache::set_meta(&key, new_etag, new_lm).await;
    Ok(data)
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
    let key = format!(
        "search:{}:{:?}:{:?}:{:?}:{:?}:{:?}:{:?}:{:?}:{:?}:{:?}:{:?}",
        keywords,
        subject_type,
        sort,
        tag,
        air_date,
        rating,
        rating_count,
        rank,
        nsfw,
        limit,
        offset
    );
    if let Some(v) = cache::get(&key).await.ok().flatten() {
        if let Ok(parsed) = serde_json::from_str::<SearchResponse>(&v) {
            return Ok(parsed);
        }
    }
    let url = format!("{}/v0/search/subjects", BGM_API_HOST);
    let client = &*CLIENT;
    let mut req = client.post(&url);
    let mut qs: Vec<(&str, String)> = Vec::new();
    if let Some(l) = limit { qs.push(("limit", l.to_string())); }
    if let Some(o) = offset { qs.push(("offset", o.to_string())); }
    if !qs.is_empty() { req = req.query(&qs); }
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
    let (etag, last_modified) = cache::get_meta(&key).await.unwrap_or((None, None));
    if let Some(e) = etag.clone() { req = req.header(IF_NONE_MATCH, e); }
    if let Some(lm) = last_modified.clone() { req = req.header(IF_MODIFIED_SINCE, lm); }
    let resp = req.json(&payload).send().await?;
    if resp.status() == StatusCode::NOT_MODIFIED {
        if let Some(v) = cache::get(&key).await.ok().flatten() {
            if let Ok(parsed) = serde_json::from_str::<SearchResponse>(&v) {
                return Ok(parsed);
            }
        }
        let mut req2 = client.post(&url);
        if !qs.is_empty() { req2 = req2.query(&qs); }
        let fallback = req2.json(&payload).send().await?;
        let headers = fallback.headers().clone();
        fallback.error_for_status_ref()?;
        let data = fallback.json::<SearchResponse>().await?;
        if let Ok(s) = serde_json::to_string(&data) { let _ = cache::set(&key, s, 3600).await; }
        let new_etag = headers.get(ETAG).and_then(|v| v.to_str().ok()).map(|s| s.to_string());
        let new_lm = headers.get(LAST_MODIFIED).and_then(|v| v.to_str().ok()).map(|s| s.to_string());
        let _ = cache::set_meta(&key, new_etag, new_lm).await;
        return Ok(data);
    }
    let headers = resp.headers().clone();
    resp.error_for_status_ref()?;
    let data = resp.json::<SearchResponse>().await?;
    if let Ok(s) = serde_json::to_string(&data) { let _ = cache::set(&key, s, 3600).await; }
    let new_etag = headers.get(ETAG).and_then(|v| v.to_str().ok()).map(|s| s.to_string());
    let new_lm = headers.get(LAST_MODIFIED).and_then(|v| v.to_str().ok()).map(|s| s.to_string());
    let _ = cache::set_meta(&key, new_etag, new_lm).await;
    Ok(data)
}

pub async fn fetch_episodes(
    subject_id: u32,
    ep_type: Option<u8>,
    limit: Option<u32>,
    offset: Option<u32>,
) -> Result<crate::models::bangumi::PagedEpisode, AppError> {
    let key = format!(
        "episodes:{}:{:?}:{:?}:{:?}",
        subject_id, ep_type, limit, offset
    );
    if let Some(v) = cache::get(&key).await.ok().flatten() {
        if let Ok(parsed) = serde_json::from_str::<crate::models::bangumi::PagedEpisode>(&v) {
            return Ok(parsed);
        }
    }
    let url = format!("{}/v0/episodes", BGM_API_HOST);
    let client = &*CLIENT;
    let mut qs: Vec<(&str, String)> = vec![("subject_id", subject_id.to_string())];
    if let Some(t) = ep_type { qs.push(("type", (t as u32).to_string())); }
    if let Some(l) = limit { qs.push(("limit", l.to_string())); }
    if let Some(o) = offset { qs.push(("offset", o.to_string())); }
    let (etag, last_modified) = cache::get_meta(&key).await.unwrap_or((None, None));
    let mut req = client.get(&url).query(&qs);
    if let Some(e) = etag.clone() { req = req.header(IF_NONE_MATCH, e); }
    if let Some(lm) = last_modified.clone() { req = req.header(IF_MODIFIED_SINCE, lm); }
    let resp = req.send().await?;
    if resp.status() == StatusCode::NOT_MODIFIED {
        if let Some(v) = cache::get(&key).await.ok().flatten() {
            if let Ok(parsed) = serde_json::from_str::<crate::models::bangumi::PagedEpisode>(&v) {
                return Ok(parsed);
            }
        }
        let fallback = client.get(&url).query(&qs).send().await?;
        let headers = fallback.headers().clone();
        fallback.error_for_status_ref()?;
        let data = fallback.json::<crate::models::bangumi::PagedEpisode>().await?;
        if let Ok(s) = serde_json::to_string(&data) { let _ = cache::set(&key, s, 3600).await; }
        let new_etag = headers.get(ETAG).and_then(|v| v.to_str().ok()).map(|s| s.to_string());
        let new_lm = headers.get(LAST_MODIFIED).and_then(|v| v.to_str().ok()).map(|s| s.to_string());
        let _ = cache::set_meta(&key, new_etag, new_lm).await;
        return Ok(data);
    }
    let headers = resp.headers().clone();
    resp.error_for_status_ref()?;
    let data = resp.json::<crate::models::bangumi::PagedEpisode>().await?;
    if let Ok(s) = serde_json::to_string(&data) { let _ = cache::set(&key, s, 3600).await; }
    let new_etag = headers.get(ETAG).and_then(|v| v.to_str().ok()).map(|s| s.to_string());
    let new_lm = headers.get(LAST_MODIFIED).and_then(|v| v.to_str().ok()).map(|s| s.to_string());
    let _ = cache::set_meta(&key, new_etag, new_lm).await;
    Ok(data)
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
