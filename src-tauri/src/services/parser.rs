use once_cell::sync::Lazy;
use regex::Regex;

static RE_RESOLUTION: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?i)\b(2160|1080|720|480)\s*[pP]\b").unwrap());
static RE_4K: Lazy<Regex> = Lazy::new(|| Regex::new(r"(?i)\b4\s*K\b").unwrap());

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
}
