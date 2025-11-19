use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};
use tokio::sync::Semaphore;
use tokio::time::{sleep, Duration};

use super::status::get_status_cached;
use super::store::list;

const REFRESH_CONCURRENCY: usize = 4;
const REFRESH_LIMIT: usize = 50;
const REFRESH_INTERVAL_SECS: u64 = 600;
static REFRESH_OFFSET: AtomicUsize = AtomicUsize::new(0);

pub fn spawn_refresh_worker() {
    tauri::async_runtime::spawn(async move {
        loop {
            let rows = match list().await {
                Ok(v) => v,
                Err(_) => {
                    sleep(Duration::from_secs(REFRESH_INTERVAL_SECS)).await;
                    continue;
                }
            };
            if rows.is_empty() {
                sleep(Duration::from_secs(REFRESH_INTERVAL_SECS)).await;
                continue;
            }
            let sem = Arc::new(Semaphore::new(REFRESH_CONCURRENCY));
            let mut handles = Vec::new();
            let total = rows.len();
            let start = REFRESH_OFFSET.load(Ordering::Relaxed) % total;
            let end = std::cmp::min(total, start + REFRESH_LIMIT);
            let mut slice: Vec<(u32, i64, bool)> = rows[start..end].to_vec();
            if slice.len() < REFRESH_LIMIT {
                let remain = REFRESH_LIMIT - slice.len();
                let extra_end = std::cmp::min(remain, total);
                slice.extend_from_slice(&rows[..extra_end]);
            }
            let processed = slice.len();
            for (id, _added_at, _notify) in slice.into_iter() {
                let sem_clone = Arc::clone(&sem);
                handles.push(tokio::spawn(async move {
                    if let Ok(_permit) = sem_clone.acquire_owned().await {
                        let _ = get_status_cached(id).await;
                    }
                }));
            }
            for h in handles {
                let _ = h.await;
            }
            let next = (start + processed) % total;
            REFRESH_OFFSET.store(next, Ordering::Relaxed);
            sleep(Duration::from_secs(REFRESH_INTERVAL_SECS)).await;
        }
    });
}