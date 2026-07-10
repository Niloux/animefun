use crate::utils::round_robin::{next_offset, round_robin_take};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use tokio::sync::Semaphore;
use tokio::task::JoinSet;
use tokio::time::{sleep, Duration};
use tracing::{debug, info, warn};

use super::index_repo::index_upsert_if_changed;
use super::repo::list;
use super::status::get_status_cached;
use crate::error::AppError;
use crate::services::bangumi;

const REFRESH_CONCURRENCY: usize = 4;
const REFRESH_LIMIT: usize = 25;
const REFRESH_INTERVAL_SECS: u64 = 600;
static REFRESH_OFFSET: AtomicUsize = AtomicUsize::new(0);

#[derive(Debug, Default, PartialEq, Eq)]
pub(super) struct RefreshStats {
    pub processed: usize,
    pub updated: usize,
    pub failed: usize,
}

impl RefreshStats {
    fn record(&mut self, result: &Result<bool, AppError>) {
        match result {
            Ok(true) => self.updated += 1,
            Ok(false) => {}
            Err(_) => self.failed += 1,
        }
    }
}

pub fn spawn_refresh_worker() {
    tauri::async_runtime::spawn(async move {
        loop {
            match refresh_once().await {
                Ok(stats) if stats.processed == 0 => info!("no subscriptions, sleeping"),
                Ok(stats) => info!(
                    processed = stats.processed,
                    updated = stats.updated,
                    failed = stats.failed,
                    "subscription refresh complete"
                ),
                Err(error) => {
                    warn!(error = %error, "subscription refresh failed");
                }
            }
            sleep(Duration::from_secs(REFRESH_INTERVAL_SECS)).await;
        }
    });
}

pub(super) async fn refresh_once() -> Result<RefreshStats, AppError> {
    let rows = list().await?;
    if rows.is_empty() {
        return Ok(RefreshStats::default());
    }

    let sem = Arc::new(Semaphore::new(REFRESH_CONCURRENCY));
    let total = rows.len();
    let mut cur_start = REFRESH_OFFSET.load(Ordering::Relaxed) % total;
    let mut stats = RefreshStats::default();

    while stats.processed < total {
        let limit = std::cmp::min(REFRESH_LIMIT, total - stats.processed);
        let (slice, processed) = round_robin_take(&rows, cur_start, limit);
        if processed == 0 {
            break;
        }
        cur_start = next_offset(total, cur_start, processed);
        stats.processed += processed;

        let mut jobs = JoinSet::new();
        for (id, added_at, _notify, _last_seen_ep, _name_cn) in slice {
            let sem = Arc::clone(&sem);
            jobs.spawn(async move {
                let result = async {
                    let _permit = sem
                        .acquire_owned()
                        .await
                        .map_err(|error| AppError::Any(error.to_string()))?;
                    debug!(id, "refresh status and index");
                    let status = get_status_cached(id).await?;
                    let subject = bangumi::fetch_subject(id).await?;
                    index_upsert_if_changed(id, added_at, subject, status.code).await
                }
                .await;
                (id, result)
            });
        }

        while let Some(result) = jobs.join_next().await {
            match result {
                Ok((id, refresh_result)) => {
                    if let Err(error) = &refresh_result {
                        warn!(id, error = %error, "subscription refresh item failed");
                    }
                    stats.record(&refresh_result);
                }
                Err(error) => {
                    stats.failed += 1;
                    warn!(error = %error, "subscription refresh task failed");
                }
            }
        }
    }

    REFRESH_OFFSET.store(cur_start, Ordering::Relaxed);
    Ok(stats)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn refresh_stats_count_updates_and_failures() {
        let mut stats = RefreshStats::default();
        stats.record(&Ok(true));
        stats.record(&Ok(false));
        stats.record(&Err(AppError::Any("failed".into())));
        assert_eq!((stats.updated, stats.failed), (1, 1));
    }
}
