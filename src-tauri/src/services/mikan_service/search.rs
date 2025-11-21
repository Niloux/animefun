use crate::cache;
use crate::error::AppError;
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
            if resp.status() != StatusCode::OK {
                resp.error_for_status_ref()?;
            }
            let h = resp.text().await?;
            let _ = cache::set(&key, h.clone(), SEARCH_TTL_SECS).await;
            h
        }
    };
    Ok(extract_bangumi_ids_from_search_page(&html))
}

fn extract_bangumi_id_from_href(href: &str) -> Option<u32> {
    let p = "/Home/Bangumi/";
    if let Some(pos) = href.find(p) {
        let s = &href[pos + p.len()..];
        let end = s.find(|c: char| !c.is_ascii_digit()).unwrap_or(s.len());
        let id_str = &s[..end];
        if id_str.is_empty() {
            None
        } else {
            id_str.parse::<u32>().ok()
        }
    } else {
        None
    }
}

pub fn extract_bangumi_ids_from_search_page(html: &str) -> Vec<u32> {
    let doc = Html::parse_document(html);
    let sel_all = Selector::parse("a").unwrap();
    let mut ids: Vec<u32> = Vec::new();
    let mut related_containers: Vec<scraper::ElementRef> = Vec::new();
    let sel_div = Selector::parse("div, section, ul").unwrap();
    for el in doc.select(&sel_div) {
        let mut has_related = false;
        for t in el.text() {
            if t.contains("相关推荐") {
                has_related = true;
                break;
            }
        }
        if has_related {
            related_containers.push(el);
        }
    }
    if !related_containers.is_empty() {
        for container in related_containers {
            for a in container.select(&sel_all) {
                if let Some(href) = a.value().attr("href") {
                    if let Some(id) = extract_bangumi_id_from_href(href) {
                        if !ids.contains(&id) {
                            ids.push(id);
                        }
                    }
                }
            }
        }
        if !ids.is_empty() {
            return ids;
        }
    }
    for a in doc.select(&sel_all) {
        if let Some(href) = a.value().attr("href") {
            if let Some(id) = extract_bangumi_id_from_href(href) {
                if !ids.contains(&id) {
                    ids.push(id);
                }
            }
        }
    }
    ids
}
