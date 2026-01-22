//! String parsing utilities
//!
//! Functions for extracting structured data from unstructured text strings.

use once_cell::sync::Lazy;
use regex::Regex;

static RE_RESOLUTION: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?i)\b(2160|1080|720|480)\s*[pP]\b").unwrap());
static RE_4K: Lazy<Regex> = Lazy::new(|| Regex::new(r"(?i)\b4\s*K\b").unwrap());

/// Extract video resolution from a filename or title string.
///
/// Supports standard resolution patterns (480P, 720P, 1080P, 2160P) and 4K notation.
/// Case-insensitive and handles whitespace variations.
///
/// # Examples
///
/// ```
/// use animefun::utils::parser::parse_resolution;
///
/// assert_eq!(parse_resolution("[ANi] 更衣人偶坠入爱河 1080P"), Some(1080));
/// assert_eq!(parse_resolution("更衣人偶坠入爱河 4K WEB-DL"), Some(2160));
/// assert_eq!(parse_resolution("无分辨率信息"), None);
/// ```
pub fn parse_resolution(text: &str) -> Option<u32> {
    // Try standard resolution pattern first
    if let Some(c) = RE_RESOLUTION.captures(text) {
        if let Ok(res) = c.get(1)?.as_str().parse::<u32>() {
            return Some(res);
        }
    }
    // Try 4K pattern
    if RE_4K.is_match(text) {
        return Some(2160);
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_resolution() {
        let t = "[ANi] 更衣人偶坠入爱河 1080P";
        assert_eq!(parse_resolution(t), Some(1080));
        let t2 = "更衣人偶坠入爱河 4K WEB-DL";
        assert_eq!(parse_resolution(t2), Some(2160));
        let t3 = "[ANi] 更衣人偶坠入爱河 720p";
        assert_eq!(parse_resolution(t3), Some(720));
    }

    #[test]
    fn test_parse_resolution_edge_cases() {
        // Empty string
        assert_eq!(parse_resolution(""), None);

        // No resolution info
        assert_eq!(parse_resolution("无分辨率信息"), None);
        assert_eq!(parse_resolution("No resolution here"), None);

        // Case insensitive
        assert_eq!(parse_resolution("1080P"), Some(1080));
        assert_eq!(parse_resolution("1080p"), Some(1080));
        assert_eq!(parse_resolution("4K"), Some(2160));
        assert_eq!(parse_resolution("4k"), Some(2160));

        // Whitespace handling
        assert_eq!(parse_resolution("1080 P"), Some(1080));
        assert_eq!(parse_resolution("1080  P"), Some(1080));

        // First match wins (when multiple resolutions present)
        assert_eq!(parse_resolution("1080p 720p"), Some(1080));

        // Standard resolutions
        assert_eq!(parse_resolution("480P"), Some(480));
        assert_eq!(parse_resolution("720P"), Some(720));
        assert_eq!(parse_resolution("1080P"), Some(1080));
        assert_eq!(parse_resolution("2160P"), Some(2160));

        // 4K variations
        assert_eq!(parse_resolution("4 K"), Some(2160));
        assert_eq!(parse_resolution("4  K"), Some(2160));

        // Real-world examples
        assert_eq!(
            parse_resolution("[ANi] 更衣人偶坠入爱河 - 01 [1080P][Bilibili]"),
            Some(1080)
        );
        assert_eq!(
            parse_resolution("[ANi] 更衣人偶坠入爱河 4K HEVC"),
            Some(2160)
        );
        assert_eq!(parse_resolution("动漫名称 720p MP4"), Some(720));
    }
}
