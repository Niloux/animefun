use governor::{DefaultDirectRateLimiter, Quota, RateLimiter};
use once_cell::sync::Lazy;
use std::num::NonZeroU32;
use std::time::Duration;

pub const USER_AGENT: &str = "animefun/0.1";
pub const HTTP_TIMEOUT_SECS: u64 = 10;
pub const HTTP_LOCAL_TIMEOUT_MS: u64 = 500;

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

pub static CLIENT_LOCAL: Lazy<reqwest::Client> = Lazy::new(|| {
    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert(
        reqwest::header::ACCEPT_ENCODING,
        reqwest::header::HeaderValue::from_static("gzip, deflate"),
    );
    reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .default_headers(headers)
        .timeout(Duration::from_millis(HTTP_LOCAL_TIMEOUT_MS))
        .gzip(true)
        .deflate(true)
        .build()
        .expect("client builder should not fail")
});

pub static LIMITER: Lazy<DefaultDirectRateLimiter> = Lazy::new(|| {
    let q = Quota::per_second(NonZeroU32::new(10).unwrap());
    RateLimiter::direct(q)
});

pub async fn wait_api_limit() {
    LIMITER.until_ready().await;
}
