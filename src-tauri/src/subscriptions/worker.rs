use crate::infra::tasks::{next_offset, round_robin_take};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use tokio::sync::Semaphore;
use tokio::time::{sleep, Duration};
use tracing::{debug, info, warn};

use super::status::get_status_cached;
use super::store::{list, upsert_index_row_if_changed};
use crate::services::bangumi_service;

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
                    warn!("subscriptions list failed");
                    sleep(Duration::from_secs(REFRESH_INTERVAL_SECS)).await;
                    continue;
                }
            };
            if rows.is_empty() {
                info!("no subscriptions, sleeping");
                sleep(Duration::from_secs(REFRESH_INTERVAL_SECS)).await;
                continue;
            }
            let sem = Arc::new(Semaphore::new(REFRESH_CONCURRENCY));
            let mut handles = Vec::new();
            let total = rows.len();
            let start = REFRESH_OFFSET.load(Ordering::Relaxed) % total;
            let (slice, processed) = round_robin_take(&rows, start, REFRESH_LIMIT);
            for (id, added_at, _notify) in slice.into_iter() {
                let sem_clone = Arc::clone(&sem);
                handles.push(tokio::spawn(async move {
                    if let Ok(_permit) = sem_clone.acquire_owned().await {
                        debug!(id, "refresh status and index");
                        let status = get_status_cached(id).await.ok();
                        let subject = bangumi_service::fetch_subject(id).await.ok();
                        if let (Some(st), Some(sj)) = (status, subject) {
                            let _ = upsert_index_row_if_changed(id, added_at, sj, st.code).await;
                        }
                    }
                }));
            }
            info!("同步 {} 个订阅状态与索引", total);
            for h in handles {
                let _ = h.await;
            }
            let next = next_offset(total, start, processed);
            REFRESH_OFFSET.store(next, Ordering::Relaxed);
            sleep(Duration::from_secs(REFRESH_INTERVAL_SECS)).await;
        }
    });
}
