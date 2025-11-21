use crate::error::AppError;
use crate::cache;
use crate::services::bangumi_service::client::CLIENT;
use reqwest::StatusCode;
use scraper::{Html, Selector};

const SEARCH_TTL_SECS: i64 = 6 * 3600;

pub async fn search_bangumi_candidates_by_name(name: &str) -> Result<Vec<u32>, AppError> {
    let key = format!("mikan:search:{}", name);
    let html = match cache::get(&key).await? {
        Some(h) => h,
        None => {
            let url = "https://mikanani.me/Home/Search";
            let resp = CLIENT.get(url).query(&[("searchstr", name)]).send().await?;
            if resp.status() != StatusCode::OK { resp.error_for_status_ref()?; }
            let h = resp.text().await?;
            let _ = cache::set(&key, h.clone(), SEARCH_TTL_SECS).await;
            h
        }
    };
    let doc = Html::parse_document(&html);
    let sel = Selector::parse("a").unwrap();
    let mut ids: Vec<u32> = Vec::new();
    for a in doc.select(&sel) {
        if let Some(href) = a.value().attr("href") {
            if let Some(id) = extract_bangumi_id_from_href(href) {
                if !ids.contains(&id) { ids.push(id); }
            }
        }
    }
    Ok(ids)
}

fn extract_bangumi_id_from_href(href: &str) -> Option<u32> {
    let p = "/Home/Bangumi/";
    if let Some(pos) = href.find(p) {
        let s = &href[pos + p.len()..];
        let end = s.find(|c: char| !c.is_ascii_digit()).unwrap_or(s.len());
        let id_str = &s[..end];
        if id_str.is_empty() { None } else { id_str.parse::<u32>().ok() }
    } else { None }
}
