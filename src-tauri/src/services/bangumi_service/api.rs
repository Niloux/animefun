use crate::cache;
use crate::error::AppError;
use crate::models::bangumi::{CalendarResponse, PagedEpisode, SearchResponse, SubjectResponse};
use reqwest::header::{ETAG, IF_MODIFIED_SINCE, IF_NONE_MATCH, LAST_MODIFIED};
use reqwest::{RequestBuilder, StatusCode};
use serde::{de::DeserializeOwned, Serialize};

use super::client::{CLIENT, BGM_API_HOST};

async fn fetch_api<T>(key: &str, req_builder: RequestBuilder, cache_duration_secs: u64) -> Result<T, AppError>
where
    T: Serialize + DeserializeOwned,
{
    if let Ok(Some(cached_data)) = cache::get(key).await {
        if let Ok(parsed) = serde_json::from_str::<T>(&cached_data) {
            return Ok(parsed);
        }
    }
    let (etag, last_modified) = cache::get_meta(key).await.unwrap_or((None, None));
    let mut req = req_builder;
    if let Some(e) = etag {
        req = req.header(IF_NONE_MATCH, e);
    }
    if let Some(lm) = last_modified {
        req = req.header(IF_MODIFIED_SINCE, lm);
    }
    let resp = req.send().await?;
    if resp.status() == StatusCode::NOT_MODIFIED {
        let cached_data = cache::get(key)
            .await?
            .ok_or_else(|| AppError::CacheMissAfter304(key.to_string()))?;
        return serde_json::from_str::<T>(&cached_data).map_err(AppError::from);
    }
    resp.error_for_status_ref()?;
    let headers = resp.headers().clone();
    let data = resp.json::<T>().await?;
    if let Ok(s) = serde_json::to_string(&data) {
        let _ = cache::set(key, s, cache_duration_secs.try_into().unwrap()).await;
    }
    let new_etag = headers.get(ETAG).and_then(|v| v.to_str().ok()).map(|s| s.to_string());
    let new_lm = headers.get(LAST_MODIFIED).and_then(|v| v.to_str().ok()).map(|s| s.to_string());
    let _ = cache::set_meta(key, new_etag, new_lm).await;
    Ok(data)
}

pub async fn fetch_calendar() -> Result<Vec<CalendarResponse>, AppError> {
    let url = format!("{}/calendar", BGM_API_HOST);
    let req_builder = CLIENT.get(&url);
    fetch_api("calendar", req_builder, 6 * 3600).await
}

pub async fn fetch_subject(id: u32) -> Result<SubjectResponse, AppError> {
    let key = format!("subject:{}", id);
    let url = format!("{}/v0/subjects/{}", BGM_API_HOST, id);
    let req_builder = CLIENT.get(&url);
    fetch_api(&key, req_builder, 24 * 3600).await
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
    let key_payload = serde_json::json!({
        "keywords": keywords, "subject_type": subject_type, "sort": sort, "tag": tag,
        "air_date": air_date, "rating": rating, "rating_count": rating_count,
        "rank": rank, "nsfw": nsfw, "limit": limit, "offset": offset
    });
    let key = format!("search:{}", serde_json::to_string(&key_payload).unwrap_or_default());
    let url = format!("{}/v0/search/subjects", BGM_API_HOST);
    #[derive(serde::Serialize)]
    struct FilterPayload {
        #[serde(rename = "type", skip_serializing_if = "Option::is_none")]
        subject_type: Option<Vec<u8>>,
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
    let payload = SearchPayload { keyword: keywords.to_string(), sort, filter: Some(FilterPayload { subject_type, tag, air_date, rating, rating_count, rank, nsfw }) };
    let mut req_builder = CLIENT.post(&url).json(&payload);
    let mut qs: Vec<(&str, String)> = Vec::new();
    if let Some(l) = limit { qs.push(("limit", l.to_string())); }
    if let Some(o) = offset { qs.push(("offset", o.to_string())); }
    if !qs.is_empty() { req_builder = req_builder.query(&qs); }
    fetch_api(&key, req_builder, 3600).await
}

pub async fn fetch_episodes(subject_id: u32, ep_type: Option<u8>, limit: Option<u32>, offset: Option<u32>) -> Result<PagedEpisode, AppError> {
    let key = format!("episodes:{}:{:?}:{:?}:{:?}", subject_id, ep_type, limit, offset);
    let url = format!("{}/v0/episodes", BGM_API_HOST);
    let mut qs: Vec<(&str, String)> = vec![("subject_id", subject_id.to_string())];
    if let Some(t) = ep_type { qs.push(("type", (t as u32).to_string())); }
    if let Some(l) = limit { qs.push(("limit", l.to_string())); }
    if let Some(o) = offset { qs.push(("offset", o.to_string())); }
    let req_builder = CLIENT.get(&url).query(&qs);
    fetch_api(&key, req_builder, 3600).await
}