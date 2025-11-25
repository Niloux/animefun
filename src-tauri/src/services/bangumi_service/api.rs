use crate::cache;
use crate::error::AppError;
use crate::models::bangumi::{CalendarResponse, PagedEpisode, SearchResponse, SubjectResponse};
use reqwest::header::{ETAG, IF_MODIFIED_SINCE, IF_NONE_MATCH, LAST_MODIFIED};
use reqwest::{RequestBuilder, StatusCode};
use serde::{de::DeserializeOwned, Serialize};
use tracing::{debug, info};

use crate::infra::config::BGM_API_HOST;
use crate::infra::http::CLIENT;

async fn fetch_api<T>(
    key: &str,
    req_builder: RequestBuilder,
    cache_duration_secs: u64,
) -> Result<T, AppError>
where
    T: Serialize + DeserializeOwned,
{
    let mut req = req_builder;
    // 尝试读取缓存条目
    let cached_entry = cache::get_entry(key).await?;

    if let Some((cached_data, etag, last_modified)) = cached_entry {
        debug!(key, "cache hit, setting conditional headers");
        // 若命中缓存，使用其元数据进行条件请求
        if let Some(ref e) = etag {
            req = req.header(IF_NONE_MATCH, e);
        }
        if let Some(ref lm) = last_modified {
            req = req.header(IF_MODIFIED_SINCE, lm);
        }

        let resp = req.send().await?;
        debug!(key, status = %resp.status().as_u16(), "http response");

        if resp.status() == StatusCode::NOT_MODIFIED {
            info!(key, "304 Not Modified, using cached data");
            // 服务器确认本地数据为最新
            // 仅需刷新缓存 TTL 并返回已有数据
            cache::set_entry(
                &key,
                cached_data.clone(),
                etag,
                last_modified,
                cache_duration_secs.try_into().unwrap(),
            )
            .await?;

            return serde_json::from_str::<T>(&cached_data).map_err(AppError::from);
        }

        // 收到 200 OK 则处理并缓存新数据
        resp.error_for_status_ref()?;
        let headers = resp.headers().clone();
        let data = resp.json::<T>().await?;

        info!(key, "cache update");
        if let Ok(s) = serde_json::to_string(&data) {
            let new_etag = headers
                .get(ETAG)
                .and_then(|v| v.to_str().ok())
                .map(String::from);
            let new_lm = headers
                .get(LAST_MODIFIED)
                .and_then(|v| v.to_str().ok())
                .map(String::from);
            cache::set_entry(
                key,
                s,
                new_etag,
                new_lm,
                cache_duration_secs.try_into().unwrap(),
            )
            .await?;
        }

        Ok(data)
    } else {
        // 未命中缓存，直接发起请求
        debug!(key, "cache miss, fetching directly");
        let resp = req.send().await?;
        resp.error_for_status_ref()?;

        let headers = resp.headers().clone();
        let data = resp.json::<T>().await?;

        info!(key, "caching new data");
        if let Ok(s) = serde_json::to_string(&data) {
            let new_etag = headers
                .get(ETAG)
                .and_then(|v| v.to_str().ok())
                .map(String::from);
            let new_lm = headers
                .get(LAST_MODIFIED)
                .and_then(|v| v.to_str().ok())
                .map(String::from);
            cache::set_entry(
                key,
                s,
                new_etag,
                new_lm,
                cache_duration_secs.try_into().unwrap(),
            )
            .await?;
        }

        Ok(data)
    }
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
    // 构造规范且稳定的缓存键
    let mut key_parts: Vec<String> = vec![format!("keywords={}", keywords)];
    if let Some(st) = &subject_type {
        key_parts.push(format!("type={:?}", st));
    }
    if let Some(s) = &sort {
        key_parts.push(format!("sort={}", s));
    }
    if let Some(t) = &tag {
        key_parts.push(format!("tag={:?}", t));
    }
    if let Some(ad) = &air_date {
        key_parts.push(format!("air_date={:?}", ad));
    }
    if let Some(r) = &rating {
        key_parts.push(format!("rating={:?}", r));
    }
    if let Some(rc) = &rating_count {
        key_parts.push(format!("rating_count={:?}", rc));
    }
    if let Some(rk) = &rank {
        key_parts.push(format!("rank={:?}", rk));
    }
    if let Some(n) = nsfw {
        key_parts.push(format!("nsfw={}", n));
    }
    if let Some(l) = limit {
        key_parts.push(format!("limit={}", l));
    }
    if let Some(o) = offset {
        key_parts.push(format!("offset={}", o));
    }
    let key = format!("search:{}", key_parts.join("&"));

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
    fetch_api(&key, req_builder, 3600).await
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
    fetch_api(&key, req_builder, 3600).await
}
