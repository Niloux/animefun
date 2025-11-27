use crate::infra::cache;
use crate::error::AppError;
use crate::infra::config::MIKAN_HOST;
use crate::infra::http::CLIENT;
use crate::models::mikan::MikanResourceItem;
use once_cell::sync::Lazy;
use regex::Regex;
use reqwest::header::{ETAG, LAST_MODIFIED};
use reqwest::StatusCode;
use std::collections::HashMap;
use std::str::FromStr;
use std::time::Instant;
use tokio::sync::{watch, Mutex};
use tracing::{info, warn};

const RSS_TTL_SECS: i64 = 6 * 3600;

static TASKS: Lazy<Mutex<HashMap<u32, watch::Sender<Option<String>>>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

enum Claim {
    Owner(watch::Sender<Option<String>>),
    Subscriber(watch::Receiver<Option<String>>),
}

async fn claim_or_subscribe(id: u32) -> Claim {
    let mut m = TASKS.lock().await;
    if let Some(tx) = m.get(&id) {
        Claim::Subscriber(tx.subscribe())
    } else {
        let (tx, _rx) = watch::channel(None);
        m.insert(id, tx.clone());
        Claim::Owner(tx)
    }
}

fn extract_meta(headers: &reqwest::header::HeaderMap) -> (Option<String>, Option<String>) {
    let new_etag = headers
        .get(ETAG)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());
    let new_lm = headers
        .get(LAST_MODIFIED)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());
    (new_etag, new_lm)
}

async fn cache_body_and_meta(key: &str, body: String, headers: &reqwest::header::HeaderMap) {
    let (new_etag, new_lm) = extract_meta(headers);
    let _ = cache::set_entry(key, body, new_etag, new_lm, RSS_TTL_SECS).await;
}

pub async fn fetch_rss(mid: u32) -> Result<Vec<MikanResourceItem>, AppError> {
    let xml = get_xml_from_cache_or_net(mid).await;
    let parse_start = Instant::now();
    let ch = match parse_rss_channel(mid, &xml) {
        Some(c) => c,
        None => return Ok(Vec::new()),
    };
    info!(bangumi_id = mid, parse_ms = %parse_start.elapsed().as_millis(), "mikan rss xml parsed");
    let build_start = Instant::now();
    let out = parse_rss_items(&ch);
    info!(bangumi_id = mid, items = out.len(), build_ms = %build_start.elapsed().as_millis(), "mikan rss items built");
    Ok(out)
}

async fn get_xml_from_cache_or_net(mid: u32) -> String {
    let key = format!("mikan:rss:{}", mid);
    let url = format!("{}/RSS/Bangumi?bangumiId={}", MIKAN_HOST, mid);
    let cached = cache::get_entry(&key).await;
    if let Ok(Some((b, _e, _l))) = cached {
        info!(bangumi_id = mid, key = %key, xml_len = b.len(), source = "cache", "mikan rss xml ready");
        return b;
    }
    let req = CLIENT.get(&url);
    match claim_or_subscribe(mid).await {
        Claim::Subscriber(mut rx) => loop {
            if let Some(v) = rx.borrow().clone() {
                break v;
            }
            if rx.changed().await.is_err() {
                break String::new();
            }
        },
        Claim::Owner(tx) => {
            let net_start = Instant::now();
            let mut out = String::new();
            match req.send().await {
                Ok(resp) => {
                    if resp.status() == StatusCode::OK {
                        let headers = resp.headers().clone();
                        match resp.text().await {
                            Ok(body) => {
                                cache_body_and_meta(&key, body.clone(), &headers).await;
                                info!(bangumi_id = mid, status = 200, net_ms = %net_start.elapsed().as_millis(), xml_len = body.len(), "mikan rss fetched and cached");
                                out = body;
                            }
                            Err(e) => {
                                warn!(error = %e, bangumi_id = mid, "mikan rss read body error");
                            }
                        }
                    } else if resp.status() == StatusCode::NOT_MODIFIED {
                        info!(bangumi_id = mid, status = 304, net_ms = %net_start.elapsed().as_millis(), "mikan rss not modified");
                    } else {
                        warn!(
                            status = resp.status().as_u16(),
                            bangumi_id = mid,
                            "mikan rss non-OK status"
                        );
                    }
                }
                Err(e) => {
                    warn!(error = %e, bangumi_id = mid, "mikan rss request error");
                }
            }
            let _ = tx.send(Some(out.clone()));
            let mut m = TASKS.lock().await;
            m.remove(&mid);
            out
        }
    }
}

fn parse_rss_channel(mid: u32, xml: &str) -> Option<rss::Channel> {
    match rss::Channel::from_str(xml) {
        Ok(c) => Some(c),
        Err(e) => {
            warn!(error = %e, bangumi_id = mid, "mikan rss parse error");
            None
        }
    }
}

fn parse_rss_items(ch: &rss::Channel) -> Vec<MikanResourceItem> {
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
        let desc = it.description().map(|s| s.to_string());
        let group = parse_group(&title);
        let (episode, episode_range) = parse_episode_info(&title);
        let resolution =
            parse_resolution(&title).or_else(|| desc.as_deref().and_then(parse_resolution));
        let (subtitle_lang, subtitle_type) = parse_subtitle(&title, desc.as_deref());
        out.push(MikanResourceItem {
            title,
            page_url,
            torrent_url,
            magnet: None,
            pub_date,
            size_bytes,
            group,
            episode,
            episode_range,
            resolution,
            subtitle_lang,
            subtitle_type,
        });
    }
    out
}

fn leading_group(text: &str) -> Option<String> {
    let t = text.trim();
    let pair = match t.chars().next() {
        Some('[') => Some(('[', ']')),
        Some('(') => Some(('(', ')')),
        Some('{') => Some(('{', '}')),
        Some('【') => Some(('【', '】')),
        _ => None,
    }?;
    let start = t.chars().next()?.len_utf8();
    let right = pair.1;
    if let Some(rel_end) = t[start..].find(right) {
        let end = start + rel_end;
        if end > start {
            let g = t[start..end].trim();
            if !g.is_empty() && g.len() <= 40 {
                return Some(g.to_string());
            }
        }
    }
    None
}

fn any_group(text: &str) -> Option<String> {
    let t = text;
    let _pairs = [('[', ']'), ('(', ')'), ('{', '}'), ('【', '】')];
    for (i, ch) in t.char_indices() {
        let right = match ch {
            '[' => Some(']'),
            '(' => Some(')'),
            '{' => Some('}'),
            '【' => Some('】'),
            _ => None,
        };
        if let Some(r) = right {
            let start = i + ch.len_utf8();
            if let Some(rel_end) = t[start..].find(r) {
                let end = start + rel_end;
                if end > start {
                    let g = t[start..end].trim();
                    if !g.is_empty() && g.len() <= 40 {
                        return Some(g.to_string());
                    }
                }
            }
        }
    }
    None
}

fn parse_group(title: &str) -> Option<String> {
    leading_group(title).or_else(|| any_group(title))
}

static RE_RANGE: Lazy<Option<Regex>> = Lazy::new(|| {
    Regex::new(r"(?i)\b(\d{1,3})\s*-\s*(\d{1,3})(?:\s*[\[(（]?(?:全集|END|完)[\])）]?)?").ok()
});
static RE_EP: Lazy<Option<Regex>> =
    Lazy::new(|| Regex::new(r"(?i)(?:EP|E|第)\s*(\d{1,3})(?:\s*(?:话|話|集))?\b").ok());
static RE_BRACKET_NUM: Lazy<Option<Regex>> =
    Lazy::new(|| Regex::new(r"(?i)[\[(（]\s*(\d{1,3})\s*[\])）]").ok());
static RE_DASH_NUM: Lazy<Option<Regex>> =
    Lazy::new(|| Regex::new(r"(?i)[\s\-]\s*(\d{1,3})\b").ok());

fn parse_episode_info(title: &str) -> (Option<u32>, Option<String>) {
    let t = title;
    if let Some(re) = RE_RANGE.as_ref() {
        if let Some(c) = re.captures(t) {
            let s = c.get(1).map(|m| m.as_str()).unwrap_or("");
            let e = c.get(2).map(|m| m.as_str()).unwrap_or("");
            let er = format!("{}-{}", s, e);
            return (None, Some(er));
        }
    }
    if let Some(re) = RE_EP.as_ref() {
        if let Some(c) = re.captures(t) {
            if let Ok(n) = c.get(1).unwrap().as_str().parse::<u32>() {
                return (Some(n), None);
            }
        }
    }
    if let Some(re) = RE_BRACKET_NUM.as_ref() {
        if let Some(c) = re.captures(t) {
            if let Ok(n) = c.get(1).unwrap().as_str().parse::<u32>() {
                return (Some(n), None);
            }
        }
    }
    if let Some(re) = RE_DASH_NUM.as_ref() {
        for c in re.captures_iter(t) {
            let m = c.get(1).unwrap();
            let s = m.as_str();
            let end = m.end();
            let next = t[end..].chars().next();
            if matches!(next, Some('p') | Some('P')) {
                continue;
            }
            if let Ok(n) = s.parse::<u32>() {
                return (Some(n), None);
            }
        }
    }
    (None, None)
}

static RE_RES_P: Lazy<Option<Regex>> =
    Lazy::new(|| Regex::new(r"(?i)\b(2160|1080|720|480)\s*[pP]\b").ok());
static RE_4K: Lazy<Option<Regex>> = Lazy::new(|| Regex::new(r"(?i)\b4\s*K\b").ok());

fn parse_resolution(text: &str) -> Option<u16> {
    let t = text;
    if let Some(re) = RE_RES_P.as_ref() {
        if let Some(c) = re.captures(t) {
            return c.get(1)?.as_str().parse::<u16>().ok();
        }
    }
    if let Some(re4k) = RE_4K.as_ref() {
        if re4k.is_match(t) {
            return Some(2160);
        }
    }
    None
}

fn parse_subtitle(title: &str, desc: Option<&str>) -> (Option<String>, Option<String>) {
    fn from_text(t: &str) -> (Option<String>, Option<String>) {
        let mut lang: Option<String> = None;
        let mut typ: Option<String> = None;
        let s = t.to_lowercase();
        if s.contains("简繁日") {
            lang = Some("简繁日".to_string())
        } else if s.contains("简日") {
            lang = Some("简日".to_string());
        } else if s.contains("简繁") || s.contains("chs&cht") || s.contains("chs+cht") {
            lang = Some("简繁".to_string());
        } else if s.contains("简体") || s.contains("chs") || s.contains("gb") {
            lang = Some("简体".to_string());
        } else if s.contains("繁体") || s.contains("cht") || s.contains("big5") {
            lang = Some("繁体".to_string());
        } else if s.contains("繁日") {
            lang = Some("繁日".to_string());
        }
        if s.contains("外挂") || s.contains("external") {
            typ = Some("外挂".to_string());
        } else if s.contains("内封")
            || s.contains("内嵌")
            || s.contains("内置")
            || s.contains("softsub")
        {
            typ = Some("内封".to_string());
        } else if s.contains("硬字幕") || s.contains("hardsub") {
            typ = Some("硬字幕".to_string());
        }
        (lang, typ)
    }
    let (l1, t1) = from_text(title);
    let (l2, t2) = desc.map(from_text).unwrap_or((None, None));
    let lang = l1.or(l2);
    let typ = t1.or(t2);
    (lang, typ)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_group_brackets() {
        let t = "【动漫国字幕组】★01月新番[恋上换装娃娃 / 更衣人偶坠入爱河][01-12(全集)][1080P][简繁外挂][MKV]";
        assert_eq!(parse_group(t).as_deref(), Some("动漫国字幕组"));
    }

    #[test]
    fn test_parse_group_square() {
        let t =
            "[H-Enc] 更衣人偶坠入爱河 / Sono Bisque Doll wa Koi wo Suru (BDRip 1080p HEVC FLAC)";
        assert_eq!(parse_group(t).as_deref(), Some("H-Enc"));
    }

    #[test]
    fn test_parse_episode_range() {
        let t = "【动漫国字幕组】恋上换装娃娃 [01-12(全集)] 1080P 简繁外挂";
        let (ep, range) = parse_episode_info(t);
        assert!(ep.is_none());
        assert_eq!(range.as_deref(), Some("01-12"));
    }

    #[test]
    fn test_parse_episode_single() {
        let t = "[Lilith-Raws] 更衣人偶坠入爱河 - 第07话 1080p";
        let (ep, range) = parse_episode_info(t);
        assert_eq!(ep, Some(7));
        assert!(range.is_none());
    }

    #[test]
    fn test_parse_resolution() {
        let t = "[ANi] 更衣人偶坠入爱河 1080P";
        assert_eq!(parse_resolution(t), Some(1080));
        let t2 = "更衣人偶坠入爱河 4K WEB-DL";
        assert_eq!(parse_resolution(t2), Some(2160));
    }

    #[test]
    fn test_parse_subtitle() {
        let t = "【动漫国字幕组】恋上换装娃娃 [01-12(全集)] 1080P 简繁外挂";
        let (lang, typ) = parse_subtitle(t, None);
        assert_eq!(lang.as_deref(), Some("简繁"));
        assert_eq!(typ.as_deref(), Some("外挂"));
        let d = Some("字幕：繁体 内封");
        let (lang2, typ2) = parse_subtitle("title", d);
        assert_eq!(lang2.as_deref(), Some("繁体"));
        assert_eq!(typ2.as_deref(), Some("内封"));
    }
}
