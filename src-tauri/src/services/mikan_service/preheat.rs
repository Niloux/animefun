use crate::infra::tasks::{next_offset, round_robin_take};
use crate::services::mikan_service::map_store;
use crate::services::mikan_service::rss;
use crate::subscriptions;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use tokio::sync::Semaphore;
use tokio::task::JoinSet;
use tokio::time::{sleep, Duration};
use tracing::{debug, info, warn};

const PREHEAT_CONCURRENCY: usize = 4;
const PREHEAT_LIMIT: usize = 30;
const PREHEAT_INTERVAL_SECS: u64 = 900;
static PREHEAT_OFFSET: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);

pub fn spawn_preheat_worker() {
    tauri::async_runtime::spawn(async move {
        loop {
            let rows = match subscriptions::repo::list().await {
                Ok(v) => v,
                Err(_) => {
                    warn!("subscriptions list failed for mikan preheat");
                    sleep(Duration::from_secs(PREHEAT_INTERVAL_SECS)).await;
                    continue;
                }
            };
            if rows.is_empty() {
                info!("no subscriptions, sleeping for mikan preheat");
                sleep(Duration::from_secs(PREHEAT_INTERVAL_SECS)).await;
                continue;
            }
            let sem = Arc::new(Semaphore::new(PREHEAT_CONCURRENCY));
            let total = rows.len();
            let cached_n = Arc::new(AtomicUsize::new(0));
            let fetched_n = Arc::new(AtomicUsize::new(0));
            let no_map_n = Arc::new(AtomicUsize::new(0));
            let mut cur_start = PREHEAT_OFFSET.load(std::sync::atomic::Ordering::Relaxed) % total;
            let mut total_processed: usize = 0;
            info!("开始同步 {} 个订阅剧集", total);
            while total_processed < total {
                let remain = total - total_processed;
                let limit = std::cmp::min(PREHEAT_LIMIT, remain);
                let (slice, processed) = round_robin_take(&rows, cur_start, limit);
                if processed == 0 {
                    break;
                }
                cur_start = next_offset(total, cur_start, processed);
                total_processed += processed;
                let mut js: JoinSet<()> = JoinSet::new();
                for (sid, _added_at, _notify) in slice.into_iter() {
                    let sem_clone = Arc::clone(&sem);
                    let cached_clone = Arc::clone(&cached_n);
                    let fetched_clone = Arc::clone(&fetched_n);
                    let no_map_clone = Arc::clone(&no_map_n);
                    js.spawn(async move {
                        if let Ok(_permit) = sem_clone.acquire_owned().await {
                            if let Ok(Some(mid)) = map_store::get(sid).await {
                                let key = format!("mikan:rss:{}", mid);
                                match crate::infra::cache::get_entry(&key).await {
                                    Ok(Some((_body, _etag, _lm))) => {
                                        cached_clone.fetch_add(1, Ordering::Relaxed);
                                        debug!(subject_id = sid, mid, "mikan preheat skip: cached");
                                    }
                                    _ => {
                                        info!(subject_id = sid, mid, "mikan preheat fetch");
                                        let _ = rss::fetch_rss(mid).await;
                                        fetched_clone.fetch_add(1, Ordering::Relaxed);
                                    }
                                }
                            } else {
                                no_map_clone.fetch_add(1, Ordering::Relaxed);
                                debug!(subject_id = sid, "mikan preheat skip: no mapping");
                            }
                        }
                    });
                }
                while js.join_next().await.is_some() {}
            }
            let cached_n = cached_n.load(Ordering::Relaxed);
            let fetched_n = fetched_n.load(Ordering::Relaxed);
            let no_map_n = no_map_n.load(Ordering::Relaxed);
            info!(
                "同步 {} 个订阅剧集完成，缓存 {} 个，获取 {} 个，无映射 {} 个",
                total_processed, cached_n, fetched_n, no_map_n
            );
            PREHEAT_OFFSET.store(cur_start, std::sync::atomic::Ordering::Relaxed);
            sleep(Duration::from_secs(PREHEAT_INTERVAL_SECS)).await;
        }
    });
}
