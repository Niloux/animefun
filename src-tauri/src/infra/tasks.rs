pub fn round_robin_take<T: Clone>(rows: &[T], start: usize, limit: usize) -> (Vec<T>, usize) {
    if rows.is_empty() {
        return (Vec::new(), 0);
    }
    let total = rows.len();
    let end = std::cmp::min(total, start + limit);
    let mut out = rows[start..end].to_vec();
    if out.len() < limit {
        let remain = limit - out.len();
        let extra_end = std::cmp::min(remain, total);
        out.extend_from_slice(&rows[..extra_end]);
    }
    let processed = out.len();
    (out, processed)
}

pub fn next_offset(total: usize, start: usize, processed: usize) -> usize {
    if total == 0 { 0 } else { (start + processed) % total }
}
