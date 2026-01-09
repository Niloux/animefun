/// 尾部标点符号
const TRAILING_PUNCTUATION: &[char] = &['。', '.', '!', '！', '?', '？', '·', '•'];

/// 规范化番剧名称（优先使用中文名）
/// 优先返回 `alt`（去除尾部标点），如果为空则返回 `name`。
pub fn normalize_name(name: &str, alt: &str) -> String {
    if alt.trim().is_empty() {
        name.to_string()
    } else {
        alt.trim()
            .trim_end_matches(TRAILING_PUNCTUATION)
            .to_string()
    }
}

/// 将所有非文字符号替换为空格，并分割成词数组
/// "A-B:C!!D" → ["A", "B", "C", "D"]
pub fn replace_and_split(name: &str) -> Vec<String> {
    let mut result = String::with_capacity(name.len());

    for c in name.chars() {
        // 保留中文、英文、数字、空格
        if c.is_alphanumeric() || c.is_whitespace() {
            result.push(c);
        } else {
            // 符号替换为空格
            if !result.ends_with(' ') {
                result.push(' ');
            }
        }
    }

    // 分割并转换为 Vec<String>
    result.split_whitespace().map(|s| s.to_string()).collect()
}

/// 从后往前逐步剔除词语，生成搜索词列表
/// ["A", "B", "C", "D"] → ["A B C D", "A B C", "A B", "A"]
pub fn generate_search_terms_by_stripping(words: &[String]) -> Vec<String> {
    let mut terms = Vec::with_capacity(words.len());

    // 从完整到逐步剔除
    for i in 0..words.len() {
        let term = words[..words.len() - i].join(" ");
        terms.push(term);
    }

    terms
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_name() {
        assert_eq!(normalize_name("Name", "中文名"), "中文名");
        assert_eq!(normalize_name("Name", ""), "Name");
        assert_eq!(normalize_name("Name", "标题！"), "标题");
    }

    #[test]
    fn test_replace_and_split() {
        // 基本符号替换
        assert_eq!(
            replace_and_split("辉夜大小姐想让我告白-超级浪漫-第二季（备注）"),
            vec!["辉夜大小姐想让我告白", "超级浪漫", "第二季", "备注"]
        );

        // 英文符号
        assert_eq!(replace_and_split("A-B:C!!D"), vec!["A", "B", "C", "D"]);

        // 连续符号
        assert_eq!(replace_and_split("标题！！副标题"), vec!["标题", "副标题"]);

        // 混合符号
        assert_eq!(
            replace_and_split("标题-副标题_备注"),
            vec!["标题", "副标题", "备注"]
        );

        // 无符号
        assert_eq!(replace_and_split("普通标题"), vec!["普通标题"]);

        // 只有符号
        assert_eq!(replace_and_split("-！！-"), Vec::<String>::new());
    }

    #[test]
    fn test_generate_search_terms_by_stripping() {
        // 四个词
        let input = vec![
            "A".to_string(),
            "B".to_string(),
            "C".to_string(),
            "D".to_string(),
        ];
        assert_eq!(
            generate_search_terms_by_stripping(&input),
            vec!["A B C D", "A B C", "A B", "A"]
        );

        // 单个词
        let input = vec!["单个词".to_string()];
        assert_eq!(generate_search_terms_by_stripping(&input), vec!["单个词"]);

        // 两个词
        let input = vec!["两个".to_string(), "词".to_string()];
        assert_eq!(
            generate_search_terms_by_stripping(&input),
            vec!["两个 词", "两个"]
        );

        // 中文标题
        let input = vec![
            "辉夜大小姐".to_string(),
            "超级浪漫".to_string(),
            "第二季".to_string(),
            "备注".to_string(),
        ];
        assert_eq!(
            generate_search_terms_by_stripping(&input),
            vec![
                "辉夜大小姐 超级浪漫 第二季 备注",
                "辉夜大小姐 超级浪漫 第二季",
                "辉夜大小姐 超级浪漫",
                "辉夜大小姐"
            ]
        );
    }
}
