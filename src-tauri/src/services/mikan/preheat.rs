use crate::error::AppError;
use crate::services::mikan::map_store;
use crate::services::mikan::rss;
use crate::services::subscriptions::{self, update_last_seen_ep};
use crate::utils::round_robin::{next_offset, round_robin_take};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use tokio::sync::Semaphore;
use tokio::task::JoinSet;
use tokio::time::{sleep, Duration};
use tracing::{debug, info, warn};

const PREHEAT_CONCURRENCY: usize = 4;
const PREHEAT_LIMIT: usize = 30;
const PREHEAT_INTERVAL_SECS: u64 = 900;
static PREHEAT_OFFSET: AtomicUsize = AtomicUsize::new(0);

enum PreheatState {
    Unchanged,
    NoMap,
    Updated,
}

#[derive(Debug, Default, PartialEq, Eq)]
pub(super) struct PreheatStats {
    pub processed: usize,
    pub updated: usize,
    pub no_map: usize,
    pub notified: usize,
    pub failed: usize,
}

impl PreheatStats {
    fn record(&mut self, notified: bool, result: &Result<PreheatState, AppError>) {
        self.notified += usize::from(notified);
        match result {
            Ok(PreheatState::Updated) => self.updated += 1,
            Ok(PreheatState::NoMap) => self.no_map += 1,
            Ok(PreheatState::Unchanged) => {}
            Err(_) => self.failed += 1,
        }
    }
}

pub fn spawn_preheat_worker() {
    tauri::async_runtime::spawn(async move {
        loop {
            match preheat_once().await {
                Ok(stats) if stats.processed == 0 => {
                    info!("no subscriptions, sleeping for mikan preheat");
                }
                Ok(stats) => info!(
                    processed = stats.processed,
                    updated = stats.updated,
                    no_map = stats.no_map,
                    notified = stats.notified,
                    failed = stats.failed,
                    "mikan preheat complete"
                ),
                Err(error) => warn!(error = %error, "mikan preheat failed"),
            }
            sleep(Duration::from_secs(PREHEAT_INTERVAL_SECS)).await;
        }
    });
}

pub(super) async fn preheat_once() -> Result<PreheatStats, AppError> {
    let rows = subscriptions::repo::list().await?;
    if rows.is_empty() {
        return Ok(PreheatStats::default());
    }

    let sem = Arc::new(Semaphore::new(PREHEAT_CONCURRENCY));
    let total = rows.len();
    let mut cur_start = PREHEAT_OFFSET.load(Ordering::Relaxed) % total;
    let mut stats = PreheatStats::default();

    while stats.processed < total {
        let limit = std::cmp::min(PREHEAT_LIMIT, total - stats.processed);
        let (slice, processed) = round_robin_take(&rows, cur_start, limit);
        if processed == 0 {
            break;
        }
        cur_start = next_offset(total, cur_start, processed);
        stats.processed += processed;

        let mut jobs = JoinSet::new();
        for (sid, _added_at, notify, last_seen_ep, name_opt) in slice {
            let sem = Arc::clone(&sem);
            jobs.spawn(async move {
                let mut notified = false;
                let result = async {
                    let _permit = sem
                        .acquire_owned()
                        .await
                        .map_err(|error| AppError::Any(error.to_string()))?;
                    let Some(mid) = map_store::get(sid).await? else {
                        debug!(subject_id = sid, "mikan preheat skip: no mapping");
                        return Ok(PreheatState::NoMap);
                    };
                    let items = rss::fetch_rss(mid).await?;
                    let new_max_ep = items
                        .iter()
                        .filter_map(|item| item.episode)
                        .max()
                        .unwrap_or(0);
                    if new_max_ep <= last_seen_ep {
                        return Ok(PreheatState::Unchanged);
                    }

                    info!(
                        subject_id = sid,
                        old_ep = last_seen_ep,
                        new_ep = new_max_ep,
                        notify,
                        "new episode detected"
                    );
                    if notify {
                        if let Some(name) = name_opt {
                            crate::infra::notification::notify_new_episode(&name, new_max_ep);
                            notified = true;
                        } else {
                            warn!(
                                subject_id = sid,
                                "anime name not found, skipping notification"
                            );
                        }
                    }
                    update_last_seen_ep(sid, new_max_ep).await?;
                    Ok(PreheatState::Updated)
                }
                .await;
                (sid, notified, result)
            });
        }

        while let Some(result) = jobs.join_next().await {
            match result {
                Ok((sid, notified, preheat_result)) => {
                    if let Err(error) = &preheat_result {
                        warn!(subject_id = sid, error = %error, "mikan preheat item failed");
                    }
                    stats.record(notified, &preheat_result);
                }
                Err(error) => {
                    stats.failed += 1;
                    warn!(error = %error, "mikan preheat task failed");
                }
            }
        }
    }

    PREHEAT_OFFSET.store(cur_start, Ordering::Relaxed);
    Ok(stats)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn preheat_stats_count_domain_outcomes() {
        let mut stats = PreheatStats::default();
        stats.record(true, &Ok(PreheatState::Updated));
        stats.record(false, &Ok(PreheatState::NoMap));
        stats.record(false, &Ok(PreheatState::Unchanged));
        stats.record(false, &Err(AppError::Any("failed".into())));
        assert_eq!(
            (stats.updated, stats.no_map, stats.notified, stats.failed),
            (1, 1, 1, 1)
        );
    }
}
