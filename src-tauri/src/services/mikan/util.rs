/// 移除季/部分后缀用于 Mikan 搜索
/// Mikan 存储基础名称，但 Bangumi 返回完整名称
pub fn strip_season_suffix(name: &str) -> String {
    // 季/部分模式（中文、英文）
    let patterns = [
        r"\s*第[一二三四五六七八九十0-9]+部分\s*$",
        r"\s*第[一二三四五六七八九十0-9]+季\s*$",
        r"\s*Season\s*\d+\s*$",
        r"\s*S\d+\s*$",
        r"\s*Part\s*\d+\s*$",
    ];

    let mut result = name.trim().to_string();

    for pattern in &patterns {
        if let Ok(re) = regex::Regex::new(pattern) {
            if re.is_match(&result) {
                result = re.replace(&result, "").trim().to_string();
                break; // 只移除一层
            }
        }
    }

    // 清理尾部标点
    let trims: [char; 8] = ['。', '.', '!', '！', '?', '？', '·', '•'];
    result.trim_end_matches(&trims[..]).trim().to_string()
}

pub fn normalize_name(name: String, alt: String) -> String {
    if alt.trim().is_empty() {
        name
    } else {
        let s = alt.trim().to_string();
        let trims: [char; 8] = ['。', '.', '!', '！', '?', '？', '·', '•'];
        s.trim_end_matches(&trims[..]).to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_strip_season_suffix() {
        assert_eq!(strip_season_suffix("赛马娘 芦毛灰姑娘 第2部分"), "赛马娘 芦毛灰姑娘");
        assert_eq!(strip_season_suffix("进击的巨人 第3季"), "进击的巨人");
        assert_eq!(strip_season_suffix("Slime Season 2"), "Slime");
        assert_eq!(strip_season_suffix("Show S3"), "Show");
        // 无后缀的正常名称保持不变
        assert_eq!(strip_season_suffix("进击的巨人"), "进击的巨人");
    }

    #[test]
    fn test_normalize_name_backward_compat() {
        assert_eq!(normalize_name("Name".into(), "中文名".into()), "中文名");
        assert_eq!(normalize_name("Name".into(), "".into()), "Name");
    }
}
