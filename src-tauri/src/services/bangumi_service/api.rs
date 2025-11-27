use crate::infra::cache;
use crate::error::AppError;
use crate::models::bangumi::{CalendarResponse, PagedEpisode, SearchResponse, SubjectResponse};
use reqwest::header::{ETAG, LAST_MODIFIED};
use reqwest::RequestBuilder;
use serde::{de::DeserializeOwned, Serialize};
use tracing::debug;

use crate::infra::config::BGM_API_HOST;
use crate::infra::http::CLIENT;

const TTL_CALENDAR_SECS: i64 = 6 * 3600;
const TTL_SUBJECT_SECS: i64 = 24 * 3600;
const TTL_SEARCH_SECS: i64 = 3600;
const TTL_EPISODES_SECS: i64 = 3600;

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
    #[derive(serde::Serialize)]
    struct SearchKey {
        keyword: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        subject_type: Option<Vec<u8>>,
        #[serde(skip_serializing_if = "Option::is_none")]
        sort: Option<String>,
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
        #[serde(skip_serializing_if = "Option::is_none")]
        limit: Option<u32>,
        #[serde(skip_serializing_if = "Option::is_none")]
        offset: Option<u32>,
    }
    fn sorted_u8(v: Option<Vec<u8>>) -> Option<Vec<u8>> {
        v.map(|mut x| {
            x.sort();
            x
        })
    }
    fn sorted_str(v: Option<Vec<String>>) -> Option<Vec<String>> {
        v.map(|mut x| {
            x.sort();
            x
        })
    }
    let key_struct = SearchKey {
        keyword: keywords.to_string(),
        subject_type: sorted_u8(subject_type.clone()),
        sort: sort.clone(),
        tag: sorted_str(tag.clone()),
        air_date: sorted_str(air_date.clone()),
        rating: sorted_str(rating.clone()),
        rating_count: sorted_str(rating_count.clone()),
        rank: sorted_str(rank.clone()),
        nsfw,
        limit,
        offset,
    };
    let key = format!(
        "search:{}",
        serde_json::to_string(&key_struct).map_err(AppError::from)?
    );

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
    let payload = SearchPayload {
        keyword: keywords.to_string(),
        sort,
        filter: Some(FilterPayload {
            subject_type,
            tag,
            air_date,
            rating,
            rating_count,
            rank,
            nsfw,
        }),
    };
    let mut req_builder = CLIENT.post(&url).json(&payload);
    let mut qs: Vec<(&str, String)> = Vec::new();
    if let Some(l) = limit {
        qs.push(("limit", l.to_string()));
    }
    if let Some(o) = offset {
        qs.push(("offset", o.to_string()));
    }
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
