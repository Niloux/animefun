use crate::cache;
use crate::error::AppError;
use crate::infra::config::MIKAN_HOST;
use crate::infra::http::CLIENT;
use reqwest::StatusCode;
use scraper::{Html, Selector};

const PAGE_TTL_SECS: i64 = 24 * 3600;

pub async fn resolve_subject(bangumi_id: u32) -> Result<Option<u32>, AppError> {
    let key = format!("mikan:bangumi:{}", bangumi_id);
    let html = match cache::get_entry(&key).await? {
        Some((h, _, _)) => h,
        None => {
            let url = format!("{}/Home/Bangumi/{}", MIKAN_HOST, bangumi_id);
            let resp = CLIENT.get(&url).send().await?;
            if resp.status() != StatusCode::OK {
                resp.error_for_status_ref()?;
            }
            let h = resp.text().await?;
            let _ = cache::set_entry(&key, h.clone(), None, None, PAGE_TTL_SECS).await;
            h
        }
    };
    let doc = Html::parse_document(&html);
    let sel = Selector::parse("a").unwrap();
    for a in doc.select(&sel) {
        if let Some(href) = a.value().attr("href") {
            if let Some(id) = parse_subject_id(href) {
                return Ok(Some(id));
            }
        }
    }
    Ok(None)
}

fn parse_subject_id(href: &str) -> Option<u32> {
    for dom in ["bgm.tv", "bangumi.tv", "chii.in"] {
        let p1 = format!("{}/subject/", dom);
        let p2 = format!("//{}/subject/", dom);
        let pos_opt = href
            .find(&p1)
            .map(|pos| pos + p1.len())
            .or_else(|| href.find(&p2).map(|pos2| pos2 + p2.len()));
        if let Some(start) = pos_opt {
            let s = &href[start..];
            let end = s.find(|c: char| !c.is_ascii_digit()).unwrap_or(s.len());
            let id_str = &s[..end];
            if id_str.is_empty() {
                continue;
            }
            if let Ok(id) = id_str.parse::<u32>() {
                return Some(id);
            }
        }
    }
    None
}
