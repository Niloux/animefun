use crate::error::AppError;
use crate::infra::cache;
use crate::infra::config::MIKAN_HOST;
use crate::infra::http::CLIENT;
use crate::models::mikan::MikanResourceItem;
use once_cell::sync::Lazy;
use regex::Regex;
use reqwest::header::{ETAG, LAST_MODIFIED};
use reqwest::StatusCode;
use std::str::FromStr;
use std::time::Instant;
use tracing::{info, warn};

const RSS_TTL_SECS: i64 = 6 * 3600;

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
    let key = format!("mikan:rss:{}", mid);
    let url = format!("{}/RSS/Bangumi?bangumiId={}", MIKAN_HOST, mid);

    let xml = if let Ok(Some((body, _etag, _last_modified))) = cache::get_entry(&key).await {
        info!(
            bangumi_id = mid,
            xml_len = body.len(),
            source = "cache",
            "mikan rss xml ready"
        );
        body
    } else {
        info!(
            bangumi_id = mid,
            "mikan rss cache miss, fetching from network"
        );

        crate::infra::http::wait_api_limit().await;
        let net_start = Instant::now();

        let resp = CLIENT.get(&url).send().await?;
        resp.error_for_status_ref()?;
        let headers = resp.headers().clone();
        let status = resp.status();

        let body = if status == StatusCode::NOT_MODIFIED {
            info!(bangumi_id = mid, net_ms = %net_start.elapsed().as_millis(), status = 304, "mikan rss not modified");

            match cache::get_entry(&key).await {
                Ok(Some((cached_body, _, _))) => cached_body,
                Ok(None) => {
                    warn!(
                        bangumi_id = mid,
                        "mikan rss 304 but no cached body, returning empty"
                    );
                    String::new()
                }
                Err(e) => {
                    warn!(error = %e, bangumi_id = mid, "mikan rss 304 but cache read error");
                    String::new()
                }
            }
        } else {
            let body = resp.text().await?;
            info!(
                bangumi_id = mid,
                net_ms = %net_start.elapsed().as_millis(),
                xml_len = body.len(),
                status = %status.as_u16(),
                "mikan rss fetched"
            );
            cache_body_and_meta(&key, body.clone(), &headers).await;
            body
        };

        body
    };

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

// Episode parsing patterns - ordered by priority
static RE_EPISODE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?i)(?:EP|E|第)\s*(\d{1,3})(?:\s*(?:话|話|集))?\b").unwrap());
static RE_RANGE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)\b(\d{1,3})\s*-\s*(\d{1,3})(?:\s*[\[(（]?(?:全集|END|完)[\])）]?)?").unwrap()
});
static RE_BRACKET_NUM: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?i)[\[(（]\s*(\d{1,3})\s*[\])）]").unwrap());
static RE_DASH_NUM: Lazy<Regex> = Lazy::new(|| Regex::new(r"(?i)[\s\-]\s*(\d{1,3})\b").unwrap());

fn parse_episode_info(title: &str) -> (Option<u32>, Option<String>) {
    // Try explicit EP/E/第 pattern first
    if let Some(c) = RE_EPISODE.captures(title) {
        if let Ok(n) = c.get(1).unwrap().as_str().parse::<u32>() {
            return (Some(n), None);
        }
    }

    // Try range pattern (e.g., "01-12")
    if let Some(c) = RE_RANGE.captures(title) {
        if let (Ok(sn), Ok(en)) = (
            c.get(1).unwrap().as_str().parse::<u32>(),
            c.get(2).unwrap().as_str().parse::<u32>(),
        ) {
            // Check if this is a season indicator like "S2 - 23" (not a range)
            if is_season_indicator(title, &c, sn) {
                return (Some(en), None);
            }
            return (None, Some(format!("{}-{}", sn, en)));
        }
    }

    // Try bracketed number (e.g., "[01]")
    if let Some(c) = RE_BRACKET_NUM.captures(title) {
        if let Ok(n) = c.get(1).unwrap().as_str().parse::<u32>() {
            return (Some(n), None);
        }
    }

    // Try standalone dash-separated number
    if let Some(n) = parse_dash_number(title) {
        return (Some(n), None);
    }

    (None, None)
}

// Check if a range match is actually a season indicator (e.g., "S2 - 23" means episode 23 of season 2)
fn is_season_indicator(title: &str, c: &regex::Captures, season_num: u32) -> bool {
    let m = c.get(0).unwrap();
    let start = m.start();
    let end = m.end();

    // Check for brackets around the match
    let prev = title[..start].chars().rev().find(|ch| !ch.is_whitespace());
    let next = title[end..].chars().find(|ch| !ch.is_whitespace());
    let bracketed = matches!(prev, Some('[') | Some('(') | Some('（') | Some('【'))
        || matches!(next, Some(']') | Some(')') | Some('）') | Some('】'));

    // Check for END/全集/完 keywords
    let has_end_marker = m.as_str().to_lowercase().contains("end")
        || m.as_str().contains("全集")
        || m.as_str().contains("完");

    if bracketed || has_end_marker {
        return false;
    }

    // Check for "S{N}" or "{N} /" or "{N}-\" patterns that indicate season
    let season_pattern = format!(r"(?i)\bS{}\b", season_num);
    let has_season_marker = Regex::new(&season_pattern)
        .ok()
        .map(|r| r.is_match(title))
        .unwrap_or(false)
        || title.contains(&format!(" {} /", season_num))
        || title.contains(&format!(" {}-", season_num))
        || title.contains(&format!(" {} -", season_num));

    has_season_marker
}

// Parse dash-separated numbers, excluding "1080p"-like patterns
fn parse_dash_number(title: &str) -> Option<u32> {
    // Remove parenthesized parts to avoid false matches
    let main = title
        .split_once('(')
        .map(|(a, _)| a)
        .unwrap_or(title)
        .split_once('（')
        .map(|(a, _)| a)
        .unwrap_or(title);

    RE_DASH_NUM
        .captures_iter(main)
        .filter_map(|c| {
            let m = c.get(1)?;
            let s = m.as_str();
            let end = m.end();

            // Skip if followed by 'p' or 'P' (resolution like 1080p)
            let next = main[end..].chars().next();
            if matches!(next, Some('p') | Some('P')) {
                return None;
            }

            s.parse::<u32>().ok()
        })
        .last()
}

static RE_RESOLUTION: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?i)\b(2160|1080|720|480)\s*[pP]\b").unwrap());
static RE_4K: Lazy<Regex> = Lazy::new(|| Regex::new(r"(?i)\b4\s*K\b").unwrap());

fn parse_resolution(text: &str) -> Option<u16> {
    // Try standard resolution pattern first
    if let Some(c) = RE_RESOLUTION.captures(text) {
        if let Ok(res) = c.get(1)?.as_str().parse::<u16>() {
            return Some(res);
        }
    }
    // Try 4K pattern
    if RE_4K.is_match(text) {
        return Some(2160);
    }
    None
}

fn parse_subtitle(title: &str, desc: Option<&str>) -> (Option<String>, Option<String>) {
    // Check title first, then description
    let (lang, typ) = parse_subtitle_text(title);
    if lang.is_some() || typ.is_some() {
        return (lang, typ);
    }
    desc.map_or((None, None), |d| parse_subtitle_text(d))
}

fn parse_subtitle_text(text: &str) -> (Option<String>, Option<String>) {
    let s = text.to_lowercase();

    // Language detection (priority order matters)
    let lang = if s.contains("简繁日") {
        Some("简繁日")
    } else if s.contains("简日") {
        Some("简日")
    } else if s.contains("简繁") || s.contains("chs&cht") || s.contains("chs+cht") {
        Some("简繁")
    } else if s.contains("简体") || s.contains("chs") || s.contains("gb") {
        Some("简体")
    } else if s.contains("繁体") || s.contains("cht") || s.contains("big5") {
        Some("繁体")
    } else if s.contains("繁日") {
        Some("繁日")
    } else {
        None
    };

    // Type detection
    let typ = if s.contains("外挂") || s.contains("external") {
        Some("外挂")
    } else if s.contains("内封")
        || s.contains("内嵌")
        || s.contains("内置")
        || s.contains("softsub")
    {
        Some("内封")
    } else if s.contains("硬字幕") || s.contains("hardsub") {
        Some("硬字幕")
    } else {
        None
    };

    (lang.map(str::to_string), typ.map(str::to_string))
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
    fn test_parse_episode_season_dash_episode() {
        let t = "[黒ネズミたち] 拥有超常技能的异世界流浪美食家 S2 / Tondemo Skill de Isekai Hourou Meshi 2 - 23 (ABEMA 1920x1080 AVC AAC MP4)";
        let (ep, range) = parse_episode_info(t);
        assert_eq!(ep, Some(23));
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
