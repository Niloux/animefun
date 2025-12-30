use crate::infra::tasks::{next_offset, round_robin_take};
use crate::services::mikan::map_store;
use crate::services::mikan::rss;
use crate::services::subscriptions::{self, update_last_seen_ep};
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
            let no_map_n = Arc::new(AtomicUsize::new(0));
            let notified_n = Arc::new(AtomicUsize::new(0));
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
                for (sid, _added_at, notify, last_seen_ep, name_opt) in slice.into_iter() {
                    let sem_clone = Arc::clone(&sem);
                    let no_map_clone = Arc::clone(&no_map_n);
                    let notified_clone = Arc::clone(&notified_n);
                    js.spawn(async move {
                        if let Ok(_permit) = sem_clone.acquire_owned().await {
                            if let Ok(Some(mid)) = map_store::get(sid).await {
                                // Always fetch RSS to check for new episodes
                                // The fetch_rss function handles cache internally
                                if let Ok(items) = rss::fetch_rss(mid).await {
                                    // Find max episode in the RSS
                                    let new_max_ep = items
                                        .iter()
                                        .filter_map(|i| i.episode)
                                        .max()
                                        .unwrap_or(0);

                                    // Check for new episode
                                    if new_max_ep > last_seen_ep {
                                        info!(
                                            subject_id = sid,
                                            old_ep = last_seen_ep,
                                            new_ep = new_max_ep,
                                            notify,
                                            "new episode detected"
                                        );

                                        // Send notification first, then update DB
                                        // This ensures notification is delivered even if DB update fails
                                        if notify {
                                            if let Some(name) = name_opt {
                                                info!(
                                                    subject_id = sid,
                                                    name = %name,
                                                    episode = new_max_ep,
                                                    "sending notification"
                                                );
                                                crate::infra::notification::notify_new_episode(
                                                    &name, new_max_ep,
                                                );
                                                notified_clone.fetch_add(1, Ordering::Relaxed);
                                            } else {
                                                warn!(subject_id = sid, "anime name not found, skipping notification");
                                            }
                                        } else {
                                            info!(subject_id = sid, "notification disabled for this subscription");
                                        }

                                        // Update DB; failure is logged but doesn't affect notification
                                        if let Err(e) = update_last_seen_ep(sid, new_max_ep).await {
                                            warn!(
                                                subject_id = sid,
                                                episode = new_max_ep,
                                                error = %e,
                                                "failed to update last_seen_ep"
                                            );
                                        }
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
            let no_map_n = no_map_n.load(Ordering::Relaxed);
            let notified_n = notified_n.load(Ordering::Relaxed);
            info!(
                "同步 {} 个订阅剧集完成，无映射 {} 个，发送通知 {} 个",
                total_processed, no_map_n, notified_n
            );
            PREHEAT_OFFSET.store(cur_start, std::sync::atomic::Ordering::Relaxed);
            sleep(Duration::from_secs(PREHEAT_INTERVAL_SECS)).await;
        }
    });
}
