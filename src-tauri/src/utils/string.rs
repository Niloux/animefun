//! String manipulation utilities
//!
//! Functions for normalizing and processing text strings, particularly for
//! anime title matching and search term generation.

/// Trailing punctuation characters that should be stripped from titles
const TRAILING_PUNCTUATION: &[char] = &['。', '.', '!', '！', '?', '？', '·', '•'];

/// Normalize anime title (prefer Chinese name).
///
/// Returns `alt` with trailing punctuation removed if non-empty,
/// otherwise returns `name`.
///
/// # Examples
///
/// ```
/// use animefun::utils::string::normalize_name;
///
/// assert_eq!(normalize_name("Name", "中文名"), "中文名");
/// assert_eq!(normalize_name("Name", ""), "Name");
/// assert_eq!(normalize_name("Name", "标题！"), "标题");
/// ```
pub fn normalize_name(name: &str, alt: &str) -> String {
    if alt.trim().is_empty() {
        name.to_string()
    } else {
        alt.trim()
            .trim_end_matches(TRAILING_PUNCTUATION)
            .to_string()
    }
}

/// Replace all non-alphanumeric symbols with spaces and split into words.
///
/// # Examples
///
/// ```
/// use animefun::utils::string::replace_and_split;
///
/// assert_eq!(
///     replace_and_split("A-B:C!!D"),
///     vec!["A", "B", "C", "D"]
/// );
/// assert_eq!(
///     replace_and_split("辉夜大小姐想让我告白-超级浪漫-第二季（备注）"),
///     vec!["辉夜大小姐想让我告白", "超级浪漫", "第二季", "备注"]
/// );
/// ```
pub fn replace_and_split(name: &str) -> Vec<String> {
    let mut result = String::with_capacity(name.len());

    for c in name.chars() {
        // Keep Chinese, English, numbers, spaces
        if c.is_alphanumeric() || c.is_whitespace() {
            result.push(c);
        } else {
            // Replace symbols with space
            if !result.ends_with(' ') {
                result.push(' ');
            }
        }
    }

    // Split and convert to Vec<String>
    result.split_whitespace().map(|s| s.to_string()).collect()
}

/// Generate search terms by progressively stripping words from the end.
///
/// # Examples
///
/// ```
/// use animefun::utils::string::generate_search_terms_by_stripping;
///
/// let input = vec!["A".to_string(), "B".to_string(), "C".to_string(), "D".to_string()];
/// assert_eq!(
///     generate_search_terms_by_stripping(&input),
///     vec!["A B C D", "A B C", "A B", "A"]
/// );
/// ```
pub fn generate_search_terms_by_stripping(words: &[String]) -> Vec<String> {
    let mut terms = Vec::with_capacity(words.len());

    // From full to progressively stripped
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
        // Basic symbol replacement
        assert_eq!(
            replace_and_split("辉夜大小姐想让我告白-超级浪漫-第二季（备注）"),
            vec!["辉夜大小姐想让我告白", "超级浪漫", "第二季", "备注"]
        );

        // English symbols
        assert_eq!(replace_and_split("A-B:C!!D"), vec!["A", "B", "C", "D"]);

        // Consecutive symbols
        assert_eq!(replace_and_split("标题！！副标题"), vec!["标题", "副标题"]);

        // Mixed symbols
        assert_eq!(
            replace_and_split("标题-副标题_备注"),
            vec!["标题", "副标题", "备注"]
        );

        // No symbols
        assert_eq!(replace_and_split("普通标题"), vec!["普通标题"]);

        // Only symbols
        assert_eq!(replace_and_split("-！！-"), Vec::<String>::new());
    }

    #[test]
    fn test_generate_search_terms_by_stripping() {
        // Four words
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

        // Single word
        let input = vec!["单个词".to_string()];
        assert_eq!(generate_search_terms_by_stripping(&input), vec!["单个词"]);

        // Two words
        let input = vec!["两个".to_string(), "词".to_string()];
        assert_eq!(
            generate_search_terms_by_stripping(&input),
            vec!["两个 词", "两个"]
        );

        // Chinese title
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
