use once_cell::sync::Lazy;
use std::time::Duration;

pub const BGM_API_HOST: &str = "https://api.bgm.tv";
pub const USER_AGENT: &str = "animefun/0.1";
pub const HTTP_TIMEOUT_SECS: u64 = 10;

pub(crate) static CLIENT: Lazy<reqwest::Client> = Lazy::new(|| {
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