pub fn normalize_name(name: String, alt: String) -> String {
    if alt.trim().is_empty() {
        name
    } else {
        let s = alt.trim().to_string();
        let trims: [char; 8] = ['。', '.', '!', '！', '?', '？', '·', '•'];
        s.trim_end_matches(&trims[..]).to_string()
    }
}

