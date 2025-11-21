use crate::cache;
use crate::error::AppError;
use crate::models::mikan::MikanResourceItem;
use crate::services::bangumi_service::client::CLIENT;
use reqwest::StatusCode;
use std::str::FromStr;
use tracing::warn;

const RSS_TTL_SECS: i64 = 6 * 3600;

pub async fn fetch_bangumi_rss(mikan_id: u32) -> Result<Vec<MikanResourceItem>, AppError> {
    let key = format!("mikan:rss:{}", mikan_id);
    let xml = match cache::get(&key).await? {
        Some(x) => x,
        None => {
            let url = format!("https://mikanani.me/RSS/Bangumi?bangumiId={}", mikan_id);
            match CLIENT.get(&url).send().await {
                Ok(resp) => {
                    if resp.status() != StatusCode::OK {
                        warn!(
                            status = resp.status().as_u16(),
                            bangumi_id = mikan_id,
                            "mikan rss non-OK status"
                        );
                        return Ok(Vec::new());
                    }
                    match resp.text().await {
                        Ok(x) => {
                            let _ = cache::set(&key, x.clone(), RSS_TTL_SECS).await;
                            x
                        }
                        Err(e) => {
                            warn!(error = %e, bangumi_id = mikan_id, "mikan rss read body error");
                            return Ok(Vec::new());
                        }
                    }
                }
                Err(e) => {
                    warn!(error = %e, bangumi_id = mikan_id, "mikan rss request error");
                    return Ok(Vec::new());
                }
            }
        }
    };
    let ch = match rss::Channel::from_str(&xml) {
        Ok(c) => c,
        Err(e) => {
            warn!(error = %e, bangumi_id = mikan_id, "mikan rss parse error");
            return Ok(Vec::new());
        }
    };
    let mut out: Vec<MikanResourceItem> = Vec::new();
    for it in ch.items() {
        let title = it.title().unwrap_or("").to_string();
        let page_url = it.link().unwrap_or("").to_string();
        let mut torrent_url: Option<String> = None;
        let mut size_bytes: Option<u64> = None;
        if let Some(enc) = it.enclosure() {
            torrent_url = Some(enc.url().to_string());
            let len_str = enc.length();
            if !len_str.is_empty() {
                size_bytes = len_str.parse::<u64>().ok();
            }
        }
        let pub_date = it.pub_date().map(|s| s.to_string());
        out.push(MikanResourceItem {
            title,
            page_url,
            torrent_url,
            magnet: None,
            pub_date,
            size_bytes,
            group: None,
        });
    }
    Ok(out)
}
