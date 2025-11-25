use crate::services::mikan_service::map_store;
use crate::services::mikan_service::rss;
use crate::subscriptions;
use std::sync::Arc;
use tokio::sync::Semaphore;
use tokio::task::JoinSet;
use crate::infra::tasks::{round_robin_take, next_offset};
use tokio::time::{sleep, Duration};
use tracing::{info, warn};

const PREHEAT_CONCURRENCY: usize = 4;
const PREHEAT_LIMIT: usize = 30;
const PREHEAT_INTERVAL_SECS: u64 = 900;
static PREHEAT_OFFSET: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);

pub fn spawn_preheat_worker() {
    info!("mikan preheat worker scheduled");
    tauri::async_runtime::spawn(async move {
        info!("mikan preheat worker started");
        loop {
            let rows = match subscriptions::list().await {
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
            let mut js: JoinSet<()> = JoinSet::new();
            let total = rows.len();
            let start = PREHEAT_OFFSET.load(std::sync::atomic::Ordering::Relaxed) % total;
            let (slice, processed) = round_robin_take(&rows, start, PREHEAT_LIMIT);
            info!(
                total,
                start,
                limit = PREHEAT_LIMIT,
                processed,
                "mikan preheat tick"
            );
            for (sid, _added_at, _notify) in slice.into_iter() {
                let sem_clone = Arc::clone(&sem);
                js.spawn(async move {
                    if let Ok(_permit) = sem_clone.acquire_owned().await {
                        if let Ok(Some(mid)) = map_store::get(sid).await {
                            let key = format!("mikan:rss:{}", mid);
                            match crate::cache::get_entry(&key).await {
                                Ok(Some((_body, _etag, _lm))) => {
                                    info!(subject_id = sid, mid, "mikan preheat skip: cached");
                                }
                                _ => {
                                    info!(subject_id = sid, mid, "mikan preheat fetch");
                                    let _ = rss::fetch_rss(mid).await;
                                }
                            }
                        } else {
                            info!(subject_id = sid, "mikan preheat skip: no mapping");
                        }
                    }
                });
            }
            while js.join_next().await.is_some() {}
            let next = next_offset(total, start, processed);
            PREHEAT_OFFSET.store(next, std::sync::atomic::Ordering::Relaxed);
            sleep(Duration::from_secs(PREHEAT_INTERVAL_SECS)).await;
        }
    });
}
