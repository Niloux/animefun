//! src-tauri/src/services/bangumi_service.rs

use crate::cache;
use crate::error::AppError;
use crate::models::bangumi::{
    CalendarResponse, Episode, PagedEpisode, SearchResponse, SubjectResponse, SubjectStatus,
    SubjectStatusCode,
};
use chrono::{Days, NaiveDate, Utc};
use once_cell::sync::Lazy;
use reqwest::header::{ETAG, IF_MODIFIED_SINCE, IF_NONE_MATCH, LAST_MODIFIED};
use reqwest::{RequestBuilder, StatusCode};
use serde::{de::DeserializeOwned, Serialize};
use std::time::Duration;

const BGM_API_HOST: &str = "https://api.bgm.tv";

pub(crate) static CLIENT: Lazy<reqwest::Client> = Lazy::new(|| {
    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert(
        reqwest::header::ACCEPT_ENCODING,
        reqwest::header::HeaderValue::from_static("gzip, deflate"),
    );
    reqwest::Client::builder()
        .user_agent("animefun/0.1")
        .default_headers(headers)
        .timeout(Duration::from_secs(10))
        .gzip(true)
        .deflate(true)
        .build()
        .expect("client builder should not fail")
});

/// 通用的 API 获取辅助函数，支持缓存。
///
/// 1. 先检查有效缓存，命中则直接返回。
/// 2. 若无有效缓存，构建带 ETag/Last-Modified 的条件请求。
/// 3. 若返回 304 Not Modified，则再次从缓存读取（应当存在）。
/// 4. 若返回新数据，解析后写入缓存并返回。
async fn fetch_api<T>(
    key: &str,
    req_builder: RequestBuilder,
    cache_duration_secs: u64,
) -> Result<T, AppError>
where
    T: Serialize + DeserializeOwned,
{
    // 1. 先尝试从缓存读取。
    if let Ok(Some(cached_data)) = cache::get(key).await {
        if let Ok(parsed) = serde_json::from_str::<T>(&cached_data) {
            return Ok(parsed);
        }
    }

    // 2. 准备带条件头的请求。
    let (etag, last_modified) = cache::get_meta(key).await.unwrap_or((None, None));
    let mut req = req_builder;
    if let Some(e) = etag {
        req = req.header(IF_NONE_MATCH, e);
    }
    if let Some(lm) = last_modified {
        req = req.header(IF_MODIFIED_SINCE, lm);
    }

    let resp = req.send().await?;

    // 3. 处理 304 Not Modified。
    if resp.status() == StatusCode::NOT_MODIFIED {
        // 服务端确认缓存仍然有效，必须从缓存读取。
        // 若读取失败，则为缓存错误，不应重新拉取。
        let cached_data = cache::get(key)
            .await?
            .ok_or_else(|| AppError::CacheMissAfter304(key.to_string()))?;
        return serde_json::from_str::<T>(&cached_data).map_err(AppError::from);
    }

    // 4. 处理新数据。
    resp.error_for_status_ref()?; // 确认成功状态码
    let headers = resp.headers().clone();
    let data = resp.json::<T>().await?;

    // 5. 更新缓存。
    if let Ok(s) = serde_json::to_string(&data) {
        let _ = cache::set(key, s, cache_duration_secs.try_into().unwrap()).await;
    }
    let new_etag = headers
        .get(ETAG)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());
    let new_lm = headers
        .get(LAST_MODIFIED)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());
    let _ = cache::set_meta(key, new_etag, new_lm).await;

    Ok(data)
}

pub async fn fetch_calendar() -> Result<Vec<CalendarResponse>, AppError> {
    const CACHE_KEY: &str = "calendar";
    let url = format!("{}/calendar", BGM_API_HOST);
    let req_builder = CLIENT.get(&url);
    fetch_api(CACHE_KEY, req_builder, 6 * 3600).await
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
    // 使用稳定的 JSON 表示作为缓存键。
    let key_payload = serde_json::json!({
        "keywords": keywords, "subject_type": subject_type, "sort": sort, "tag": tag,
        "air_date": air_date, "rating": rating, "rating_count": rating_count,
        "rank": rank, "nsfw": nsfw, "limit": limit, "offset": offset
    });
    let key = format!(
        "search:{}",
        serde_json::to_string(&key_payload).unwrap_or_default()
    );

    let url = format!("{}/v0/search/subjects", BGM_API_HOST);

    // 负载使用拥有所有权的类型，避免异步 reqwest 的生命周期问题。
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
        "episodes:{}:{:?}:{:?}:{:?}",
        subject_id, ep_type, limit, offset
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

fn parse_date(s: &str) -> Option<NaiveDate> {
    NaiveDate::parse_from_str(s, "%Y-%m-%d").ok()
}

fn latest_episode_airdate(episodes: &[Episode]) -> Option<String> {
    let ep = episodes.iter().filter(|e| e.item_type == 0).max_by(|a, b| {
        a.sort
            .partial_cmp(&b.sort)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    ep.map(|e| e.airdate.clone()).filter(|d| !d.is_empty())
}

fn within_window(date: Option<NaiveDate>, window_start: NaiveDate) -> bool {
    match date {
        Some(d) => d >= window_start,
        None => false,
    }
}

fn is_finished(expected_eps: Option<u32>, current_eps: Option<u32>) -> bool {
    match (expected_eps, current_eps) {
        (Some(exp), Some(cur)) if exp > 0 && cur >= exp => true,
        _ => false,
    }
}

fn determine_code(
    first_air: Option<NaiveDate>,
    latest_air: Option<NaiveDate>,
    calendar_on_air: bool,
    finished: bool,
    today: NaiveDate,
    window_start: NaiveDate,
) -> SubjectStatusCode {
    match first_air {
        Some(fa) if fa > today => SubjectStatusCode::PreAir,
        Some(_) => {
            if calendar_on_air {
                SubjectStatusCode::Airing
            } else if finished {
                SubjectStatusCode::Finished
            } else if within_window(latest_air, window_start) {
                SubjectStatusCode::Airing
            } else {
                SubjectStatusCode::OnHiatus
            }
        }
        None => {
            if calendar_on_air {
                SubjectStatusCode::Airing
            } else if finished {
                SubjectStatusCode::Finished
            } else if within_window(latest_air, window_start) {
                SubjectStatusCode::Airing
            } else {
                SubjectStatusCode::Unknown
            }
        }
    }
}

fn status_reason(code: &SubjectStatusCode, calendar_on_air: bool) -> String {
    match code {
        SubjectStatusCode::PreAir => "未开播".to_string(),
        SubjectStatusCode::Airing => {
            if calendar_on_air {
                "当周日历在播".to_string()
            } else {
                "最近三周有更新".to_string()
            }
        }
        SubjectStatusCode::Finished => "集数达成".to_string(),
        SubjectStatusCode::OnHiatus => "超过三周未更新".to_string(),
        SubjectStatusCode::Unknown => "信息不足".to_string(),
    }
}

pub async fn calc_subject_status(id: u32) -> Result<SubjectStatus, AppError> {
    let (subject_res, calendar_res, initial_eps_res) = tokio::join!(
        fetch_subject(id),
        fetch_calendar(),
        fetch_episodes(id, None, Some(200), Some(0)),
    );
    let subject = subject_res?;
    let calendar = calendar_res?;

    let calendar_on_air = calendar
        .iter()
        .any(|day| day.items.iter().any(|item| item.id == id));

    let first_air_date: Option<String> = subject.date.clone();
    let expected_eps: Option<u32> = subject.eps;
    let mut current_eps: Option<u32> = subject.total_episodes;

    let mut latest_airdate: Option<String> = None;
    let initial_eps = initial_eps_res?;
    if current_eps.is_none() {
        current_eps = Some(initial_eps.total);
    }
    if initial_eps.total > 0 {
        let limit = initial_eps.limit.max(1);
        let total = initial_eps.total;
        let offset_last = ((total.saturating_sub(1)) / limit) * limit;
        let last_page = if offset_last == initial_eps.offset {
            initial_eps
        } else {
            fetch_episodes(id, None, Some(limit), Some(offset_last)).await?
        };
        latest_airdate = latest_episode_airdate(&last_page.data);
    }

    let today = Utc::now().date_naive();
    let window_days = 21u64;
    let window_start = today
        .checked_sub_days(Days::new(window_days))
        .unwrap_or(today);

    let first_air = first_air_date.as_ref().and_then(|d| parse_date(d));
    let latest_air = latest_airdate.as_ref().and_then(|d| parse_date(d));

    let finished = is_finished(expected_eps, current_eps);
    let code = determine_code(
        first_air,
        latest_air,
        calendar_on_air,
        finished,
        today,
        window_start,
    );

    let reason = status_reason(&code, calendar_on_air);

    Ok(SubjectStatus {
        code,
        first_air_date,
        latest_airdate,
        expected_eps,
        current_eps,
        calendar_on_air,
        reason,
    })
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
        let res = search_subject(
            "Fate",
            Some(vec![2]),
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            Some(10),
            Some(0),
        )
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

    #[tokio::test]
    async fn test_calc_subject_status_returns_any_code() {
        let res = calc_subject_status(12381).await.unwrap();
        match res.code {
            SubjectStatusCode::PreAir
            | SubjectStatusCode::Airing
            | SubjectStatusCode::Finished
            | SubjectStatusCode::OnHiatus
            | SubjectStatusCode::Unknown => {}
        }
    }
}
