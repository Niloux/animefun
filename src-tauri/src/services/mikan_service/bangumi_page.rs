use crate::error::AppError;
use crate::cache;
use crate::services::bangumi_service::client::CLIENT;
use reqwest::StatusCode;
use scraper::{Html, Selector};

const PAGE_TTL_SECS: i64 = 24 * 3600;

pub async fn resolve_subject_explicit(bangumi_id: u32) -> Result<Option<u32>, AppError> {
    let key = format!("mikan:bangumi:{}", bangumi_id);
    let html = match cache::get(&key).await? {
        Some(h) => h,
        None => {
            let url = format!("https://mikanani.me/Home/Bangumi/{}", bangumi_id);
            let resp = CLIENT.get(&url).send().await?;
            if resp.status() != StatusCode::OK { resp.error_for_status_ref()?; }
            let h = resp.text().await?;
            let _ = cache::set(&key, h.clone(), PAGE_TTL_SECS).await;
            h
        }
    };
    let doc = Html::parse_document(&html);
    let sel = Selector::parse("a").unwrap();
    for a in doc.select(&sel) {
        if let Some(href) = a.value().attr("href") {
            if let Some(id) = extract_subject_id_from_href(href) {
                return Ok(Some(id));
            }
        }
    }
    Ok(None)
}

fn extract_subject_id_from_href(href: &str) -> Option<u32> {
    for dom in ["bgm.tv", "bangumi.tv", "chii.in"] {
        let p1 = format!("{}/subject/", dom);
        let p2 = format!("//{}/subject/", dom);
        let pos_opt = if let Some(pos) = href.find(&p1) {
            Some(pos + p1.len())
        } else if let Some(pos2) = href.find(&p2) {
            Some(pos2 + p2.len())
        } else {
            None
        };
        if let Some(start) = pos_opt {
            let s = &href[start..];
            let end = s.find(|c: char| !c.is_ascii_digit()).unwrap_or(s.len());
            let id_str = &s[..end];
            if id_str.is_empty() { continue; }
            if let Ok(id) = id_str.parse::<u32>() { return Some(id); }
        }
    }
    None
}
