use crate::error::AppError;
use crate::infra::cache;
use crate::models::bangumi::{CalendarResponse, PagedEpisode, SearchResponse, SubjectResponse};
use reqwest::header::{ETAG, LAST_MODIFIED};
use reqwest::RequestBuilder;
use serde::{de::DeserializeOwned, Serialize};
use tracing::debug;

use crate::infra::config::BGM_API_HOST;
use crate::infra::http::CLIENT;

/// TODO: 后边可以考虑做进setting可配置项中
const TTL_CALENDAR_SECS: i64 = 3600;
const TTL_SUBJECT_SECS: i64 = 3600;
const TTL_SEARCH_SECS: i64 = 3600;
const TTL_EPISODES_SECS: i64 = 3600;

/// Build cache key from search parameters (all fields sorted for consistency)
fn build_search_key(
    keyword: &str,
    subject_type: &Option<Vec<u8>>,
    sort: &Option<String>,
    tag: &Option<Vec<String>>,
    air_date: &Option<Vec<String>>,
    rating: &Option<Vec<String>>,
    rating_count: &Option<Vec<String>>,
    rank: &Option<Vec<String>>,
    nsfw: &Option<bool>,
    limit: &Option<u32>,
    offset: &Option<u32>,
) -> String {
    use std::collections::HashMap;

    let mut map = HashMap::new();
    map.insert("keyword", keyword.to_string());
    if let Some(v) = sort {
        map.insert("sort", v.clone());
    }
    if let Some(v) = nsfw {
        map.insert("nsfw", v.to_string());
    }
    if let Some(v) = limit {
        map.insert("limit", v.to_string());
    }
    if let Some(v) = offset {
        map.insert("offset", v.to_string());
    }

    // Sort array fields for consistent caching
    if let Some(mut v) = subject_type.clone() {
        v.sort();
        map.insert(
            "subject_type",
            serde_json::to_string(&v).unwrap_or_default(),
        );
    }
    if let Some(mut v) = tag.clone() {
        v.sort();
        map.insert("tag", serde_json::to_string(&v).unwrap_or_default());
    }
    if let Some(mut v) = air_date.clone() {
        v.sort();
        map.insert("air_date", serde_json::to_string(&v).unwrap_or_default());
    }
    if let Some(mut v) = rating.clone() {
        v.sort();
        map.insert("rating", serde_json::to_string(&v).unwrap_or_default());
    }
    if let Some(mut v) = rating_count.clone() {
        v.sort();
        map.insert(
            "rating_count",
            serde_json::to_string(&v).unwrap_or_default(),
        );
    }
    if let Some(mut v) = rank.clone() {
        v.sort();
        map.insert("rank", serde_json::to_string(&v).unwrap_or_default());
    }

    format!("search:{}", serde_json::to_string(&map).unwrap_or_default())
}

/// Build Bangumi API search payload directly
fn build_search_payload(
    keyword: &str,
    sort: &Option<String>,
    subject_type: &Option<Vec<u8>>,
    tag: &Option<Vec<String>>,
    air_date: &Option<Vec<String>>,
    rating: &Option<Vec<String>>,
    rating_count: &Option<Vec<String>>,
    rank: &Option<Vec<String>>,
    nsfw: &Option<bool>,
) -> serde_json::Value {
    let mut payload = serde_json::json!({ "keyword": keyword });

    let obj = payload.as_object_mut().unwrap();
    if let Some(v) = sort {
        obj.insert("sort".into(), v.clone().into());
    }

    // Build filter object only if we have filter params
    let mut filter = serde_json::Map::new();
    if let Some(v) = subject_type {
        filter.insert("type".into(), v.clone().into());
    }
    if let Some(v) = tag {
        filter.insert("tag".into(), v.clone().into());
    }
    if let Some(v) = air_date {
        filter.insert("airDate".into(), v.clone().into());
    }
    if let Some(v) = rating {
        filter.insert("rating".into(), v.clone().into());
    }
    if let Some(v) = rating_count {
        filter.insert("ratingCount".into(), v.clone().into());
    }
    if let Some(v) = rank {
        filter.insert("rank".into(), v.clone().into());
    }
    if let Some(v) = nsfw {
        filter.insert("nsfw".into(), (*v).into());
    }

    if !filter.is_empty() {
        obj.insert("filter".into(), filter.into());
    }

    payload
}

fn build_limit_offset(limit: Option<u32>, offset: Option<u32>) -> Vec<(&'static str, String)> {
    let mut v = Vec::new();
    if let Some(l) = limit {
        v.push(("limit", l.to_string()));
    }
    if let Some(o) = offset {
        v.push(("offset", o.to_string()));
    }
    v
}

async fn fetch_api<T>(
    key: &str,
    req_builder: RequestBuilder,
    cache_duration_secs: i64,
) -> Result<T, AppError>
where
    T: Serialize + DeserializeOwned,
{
    // 命中缓存则直接返回，不走网络
    if let Some((cached_data, _etag, _last_modified)) = cache::get_entry(key).await? {
        debug!(key, "cache hit, returning cached data");
        return serde_json::from_str::<T>(&cached_data).map_err(AppError::from);
    }

    // 未命中缓存，直接发起请求
    crate::infra::http::wait_api_limit().await;
    let resp = req_builder.send().await?;
    resp.error_for_status_ref()?;

    let headers = resp.headers().clone();
    let data = resp.json::<T>().await?;

    if let Ok(s) = serde_json::to_string(&data) {
        let new_etag = headers
            .get(ETAG)
            .and_then(|v| v.to_str().ok())
            .map(String::from);
        let new_lm = headers
            .get(LAST_MODIFIED)
            .and_then(|v| v.to_str().ok())
            .map(String::from);
        cache::set_entry(key, s, new_etag, new_lm, cache_duration_secs).await?;
    }

    Ok(data)
}

pub async fn fetch_calendar() -> Result<Vec<CalendarResponse>, AppError> {
    let url = format!("{}/calendar", BGM_API_HOST);
    let req_builder = CLIENT.get(&url);
    fetch_api("calendar", req_builder, TTL_CALENDAR_SECS).await
}

pub async fn fetch_subject(id: u32) -> Result<SubjectResponse, AppError> {
    let key = format!("subject:{}", id);
    let url = format!("{}/v0/subjects/{}", BGM_API_HOST, id);
    let req_builder = CLIENT.get(&url);
    fetch_api(&key, req_builder, TTL_SUBJECT_SECS).await
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
    let key = build_search_key(
        keywords,
        &subject_type,
        &sort,
        &tag,
        &air_date,
        &rating,
        &rating_count,
        &rank,
        &nsfw,
        &limit,
        &offset,
    );
    let url = format!("{}/v0/search/subjects", BGM_API_HOST);
    let payload = build_search_payload(
        keywords,
        &sort,
        &subject_type,
        &tag,
        &air_date,
        &rating,
        &rating_count,
        &rank,
        &nsfw,
    );
    let mut req_builder = CLIENT.post(&url).json(&payload);
    let qs = build_limit_offset(limit, offset);
    if !qs.is_empty() {
        req_builder = req_builder.query(&qs);
    }
    fetch_api(&key, req_builder, TTL_SEARCH_SECS).await
}

pub async fn fetch_episodes(
    subject_id: u32,
    ep_type: Option<u8>,
    limit: Option<u32>,
    offset: Option<u32>,
) -> Result<PagedEpisode, AppError> {
    let key = format!(
        "episodes:{}:{}:{}:{}",
        subject_id,
        ep_type.map(|v| v.to_string()).unwrap_or_default(),
        limit.map(|v| v.to_string()).unwrap_or_default(),
        offset.map(|v| v.to_string()).unwrap_or_default()
    );
    let url = format!("{}/v0/episodes", BGM_API_HOST);
    let mut qs: Vec<(&str, String)> = vec![("subject_id", subject_id.to_string())];
    if let Some(t) = ep_type {
        qs.push(("type", (t as u32).to_string()));
    }
    if let Some(l) = limit {
        qs.push(("limit", l.to_string()));
    }
    if let Some(o) = offset {
        qs.push(("offset", o.to_string()));
    }
    let req_builder = CLIENT.get(&url).query(&qs);
    fetch_api(&key, req_builder, TTL_EPISODES_SECS).await
}
