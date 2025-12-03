pub fn round_robin_take<T: Clone>(rows: &[T], start: usize, limit: usize) -> (Vec<T>, usize) {
    if rows.is_empty() {
        return (Vec::new(), 0);
    }
    let total = rows.len();
    let take = std::cmp::min(limit, total);
    let first_len = std::cmp::min(take, total - start);
    let mut out = rows[start..start + first_len].to_vec();
    if first_len < take {
        let second_len = take - first_len;
        out.extend_from_slice(&rows[..second_len]);
    }
    (out, take)
}

pub fn next_offset(total: usize, start: usize, processed: usize) -> usize {
    if total == 0 {
        0
    } else {
        (start + processed) % total
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn take_no_wrap() {
        let rows = vec![1, 2, 3, 4, 5];
        let (s, n) = round_robin_take(&rows, 1, 2);
        assert_eq!(s, vec![2, 3]);
        assert_eq!(n, 2);
    }

    #[test]
    fn take_wrap_unique() {
        let rows = vec![1, 2, 3, 4, 5];
        let (s, n) = round_robin_take(&rows, 3, 4);
        assert_eq!(s, vec![4, 5, 1, 2]);
        assert_eq!(n, 4);
    }

    #[test]
    fn take_limit_gt_total() {
        let rows = vec![1, 2, 3];
        let (s, n) = round_robin_take(&rows, 2, 10);
        assert_eq!(s, vec![3, 1, 2]);
        assert_eq!(n, 3);
    }
}
