use governor::{DefaultDirectRateLimiter, Quota, RateLimiter};
use once_cell::sync::Lazy;
use std::num::NonZeroU32;
use std::time::Duration;

// 从 config.rs 导入常量
use super::config::{API_RATE_LIMIT, HTTP_TIMEOUT_SECS, USER_AGENT};

pub static CLIENT: Lazy<reqwest::Client> = Lazy::new(|| {
    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert(
        reqwest::header::ACCEPT_ENCODING,
        reqwest::header::HeaderValue::from_static("gzip, deflate"),
    );
    reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .default_headers(headers)
        .timeout(Duration::from_secs(HTTP_TIMEOUT_SECS))
        .gzip(true)
        .deflate(true)
        .build()
        .expect("client builder should not fail")
});

pub static LIMITER: Lazy<DefaultDirectRateLimiter> = Lazy::new(|| {
    let q = Quota::per_second(NonZeroU32::new(API_RATE_LIMIT).unwrap());
    RateLimiter::direct(q)
});

pub async fn wait_api_limit() {
    LIMITER.until_ready().await;
}
