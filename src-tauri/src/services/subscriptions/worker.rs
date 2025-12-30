use crate::infra::tasks::{next_offset, round_robin_take};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use tokio::sync::Semaphore;
use tokio::time::{sleep, Duration};
use tracing::{debug, info, warn};

use super::index_repo::index_upsert_if_changed;
use super::repo::list;
use super::status::get_status_cached;
use crate::services::bangumi;

const REFRESH_CONCURRENCY: usize = 4;
const REFRESH_LIMIT: usize = 25;
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
            let updated = Arc::new(AtomicUsize::new(0));
            let total = rows.len();
            let mut cur_start = REFRESH_OFFSET.load(Ordering::Relaxed) % total;
            let mut total_processed: usize = 0;
            info!("开始同步 {} 个订阅状态与索引", total);
            while total_processed < total {
                let remain = total - total_processed;
                let limit = std::cmp::min(REFRESH_LIMIT, remain);
                let (slice, processed) = round_robin_take(&rows, cur_start, limit);
                if processed == 0 {
                    break;
                }
                cur_start = next_offset(total, cur_start, processed);
                total_processed += processed;
                let mut handles = Vec::new();
                for (id, added_at, _notify, _last_seen_ep, _name_cn) in slice.into_iter() {
                    let sem_clone = Arc::clone(&sem);
                    let updated_clone = Arc::clone(&updated);
                    handles.push(tokio::spawn(async move {
                        if let Ok(_permit) = sem_clone.acquire_owned().await {
                            debug!(id, "refresh status and index");
                            let status = get_status_cached(id).await.ok();
                            let subject = bangumi::fetch_subject(id).await.ok();
                            if let (Some(st), Some(sj)) = (status, subject) {
                                if let Ok(true) =
                                    index_upsert_if_changed(id, added_at, sj, st.code).await
                                {
                                    updated_clone.fetch_add(1, Ordering::Relaxed);
                                }
                            }
                        }
                    }));
                }
                for h in handles {
                    let _ = h.await;
                }
            }
            let updated_n = updated.load(Ordering::Relaxed);
            info!(
                "同步完成，已处理 {} 个，更新 {} 个",
                total_processed, updated_n
            );
            REFRESH_OFFSET.store(cur_start, Ordering::Relaxed);
            sleep(Duration::from_secs(REFRESH_INTERVAL_SECS)).await;
        }
    });
}
