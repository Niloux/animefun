use crate::cache;
use crate::error::AppError;
use crate::infra::http::CLIENT;
use reqwest::StatusCode;
use scraper::{Html, Selector};
use std::collections::HashSet;

const SEARCH_TTL_SECS: i64 = 6 * 3600;

pub async fn search_candidates(name: &str) -> Result<Vec<u32>, AppError> {
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
    Ok(parse_bangumi_ids(&html))
}

fn parse_bangumi_id(href: &str) -> Option<u32> {
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

pub fn parse_bangumi_ids(html: &str) -> Vec<u32> {
    let doc = Html::parse_document(html);
    let sel_all = Selector::parse("a").unwrap();
    let mut ids: HashSet<u32> = HashSet::new();
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
                    if let Some(id) = parse_bangumi_id(href) {
                        ids.insert(id);
                    }
                }
            }
        }
        if !ids.is_empty() {
            return ids.into_iter().collect();
        }
    }
    for a in doc.select(&sel_all) {
        if let Some(href) = a.value().attr("href") {
            if let Some(id) = parse_bangumi_id(href) {
                ids.insert(id);
            }
        }
    }
    ids.into_iter().collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_ids_related_priority() {
        let html = r#"
        <div>
            <a href="/Home/Bangumi/12">x</a>
            <a href="/Home/Bangumi/34">y</a>
        </div>
        <section>
            相关推荐
            <a href="/Home/Bangumi/56">z</a>
            <a href="/Home/Bangumi/78">w</a>
        </section>
        "#;
        let ids = parse_bangumi_ids(html);
        assert_eq!(ids.len(), 2);
        assert!(ids.contains(&56));
        assert!(ids.contains(&78));
    }

    #[test]
    fn test_extract_ids_global_fallback() {
        let html = r#"
        <div>
            <a href="/Home/Bangumi/99">x</a>
            <a href="/Home/Bangumi/99">y</a>
        </div>
        "#;
        let ids = parse_bangumi_ids(html);
        assert_eq!(ids, vec![99]);
    }

    #[test]
    fn test_extract_id_from_href() {
        assert_eq!(parse_bangumi_id("/Home/Bangumi/123"), Some(123));
        assert_eq!(parse_bangumi_id("/Home/Bangumi/123?x=1"), Some(123));
        assert_eq!(parse_bangumi_id("/Home/Bangumi/"), None);
        assert_eq!(parse_bangumi_id("/Other/123"), None);
    }
}
