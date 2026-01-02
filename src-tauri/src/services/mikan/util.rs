/// 移除括号及其内容 (用于搜索关键词预处理)
/// 支持半角括号 () 和全角括号（）
fn remove_paren_content(name: &str) -> String {
    // 匹配模式: (内容) 或 （内容）
    // 使用惰性匹配避免跨多个括号匹配
    let re = regex::Regex::new(r"[\(（].*?[\)）]\s*").unwrap();
    re.replace_all(name, "").trim().to_string()
}

/// 规范化番剧名称用于 Mikan 搜索
/// 1. 移除括号及其内容 (Mikan 对括号处理异常)
/// 2. 移除季号/部分后缀 (Mikan 存储基础名称)
/// 3. 清理尾部标点
pub fn normalize_for_search(name: &str) -> String {
    let mut result = name.trim().to_string();

    // 先移除括号及其内容 (可能位于季号后缀之后)
    result = remove_paren_content(&result);

    // 季/部分模式（中文、英文）
    let patterns = [
        r"\s*第[一二三四五六七八九十0-9]+部分\s*$",
        r"\s*第[一二三四五六七八九十0-9]+季\s*$",
        r"\s*Season\s*\d+\s*$",
        r"\s*S\d+\s*$",
        r"\s*Part\s*\d+\s*$",
    ];

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
    fn test_normalize_for_search() {
        // 季号/部分后缀移除
        assert_eq!(normalize_for_search("赛马娘 芦毛灰姑娘 第2部分"), "赛马娘 芦毛灰姑娘");
        assert_eq!(normalize_for_search("进击的巨人 第3季"), "进击的巨人");
        assert_eq!(normalize_for_search("Slime Season 2"), "Slime");
        assert_eq!(normalize_for_search("Show S3"), "Show");
        // 无后缀的正常名称保持不变
        assert_eq!(normalize_for_search("进击的巨人"), "进击的巨人");
        // 括号内容移除
        assert_eq!(normalize_for_search("我们不可能成为恋人！绝对不行。 (※似乎可行？)"), "我们不可能成为恋人！绝对不行");
        assert_eq!(normalize_for_search("标题（备注内容）"), "标题");
        assert_eq!(normalize_for_search("Test (Extra Info)"), "Test");
        // 组合: 季号 + 括号
        assert_eq!(normalize_for_search("番剧名 第2季 (备注)"), "番剧名");
    }

    #[test]
    fn test_normalize_name_backward_compat() {
        assert_eq!(normalize_name("Name".into(), "中文名".into()), "中文名");
        assert_eq!(normalize_name("Name".into(), "".into()), "Name");
    }
}
