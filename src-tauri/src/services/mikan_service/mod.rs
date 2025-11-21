use crate::error::AppError;
use crate::models::mikan::{MikanResourceItem, MikanResourcesResponse};
use crate::services::bangumi_service;
use crate::subscriptions;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Semaphore;
use tokio::task::JoinSet;
use tokio::time::{sleep, Duration};
use tracing::{info, warn};

const MAX_CONCURRENCY: usize = 5;

pub fn init(base_dir: PathBuf) -> Result<(), AppError> {
    map_store::init(base_dir)
}

fn normalize_name(name: String, alt: String) -> String {
    if alt.trim().is_empty() {
        name
    } else {
        let s = alt.trim().to_string();
        let trims: [char; 8] = ['。', '.', '!', '！', '?', '？', '·', '•'];
        s.trim_end_matches(&trims[..]).to_string()
    }
}

pub async fn ensure_map(sid: u32) -> Result<Option<u32>, AppError> {
    if let Some(mid) = map_store::get(sid).await? {
        return Ok(Some(mid));
    }
    let subject = bangumi_service::api::fetch_subject(sid).await?;
    let name = normalize_name(subject.name, subject.name_cn);
    let candidates = search::search_candidates(&name).await?;
    if candidates.is_empty() {
        return Ok(None);
    }
    let res = resolve_candidates(sid, candidates, MAX_CONCURRENCY).await?;
    if let Some(bid) = res {
        map_store::upsert(sid, bid, 1.0, "explicit", false).await?;
        return Ok(Some(bid));
    }
    Ok(None)
}

pub async fn get_mikan_resources(subject_id: u32) -> Result<MikanResourcesResponse, AppError> {
    let mut mid = map_store::get(subject_id).await?;
    if mid.is_none() {
        mid = ensure_map(subject_id).await?;
    }
    if let Some(mikan_id) = mid {
        let items: Vec<MikanResourceItem> = rss::fetch_rss(mikan_id).await?;
        Ok(MikanResourcesResponse {
            mapped: true,
            mikan_bangumi_id: Some(mikan_id),
            items,
        })
    } else {
        Ok(MikanResourcesResponse {
            mapped: false,
            mikan_bangumi_id: None,
            items: Vec::new(),
        })
    }
}

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
            let end = std::cmp::min(total, start + PREHEAT_LIMIT);
            let mut slice: Vec<(u32, i64, bool)> = rows[start..end].to_vec();
            if slice.len() < PREHEAT_LIMIT {
                let remain = PREHEAT_LIMIT - slice.len();
                let extra_end = std::cmp::min(remain, total);
                slice.extend_from_slice(&rows[..extra_end]);
            }
            let processed = slice.len();
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
                            match crate::cache::get(&key).await {
                                Ok(Some(_)) => {
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
            let next = (start + processed) % total;
            PREHEAT_OFFSET.store(next, std::sync::atomic::Ordering::Relaxed);
            sleep(Duration::from_secs(PREHEAT_INTERVAL_SECS)).await;
        }
    });
}

async fn resolve_candidates(
    sid: u32,
    candidates: Vec<u32>,
    max: usize,
) -> Result<Option<u32>, AppError> {
    let mut js: JoinSet<(u32, Result<Option<u32>, AppError>)> = JoinSet::new();
    let mut idx = 0usize;
    while idx < candidates.len() && js.len() < max {
        let bid = candidates[idx];
        idx += 1;
        js.spawn(async move { (bid, bangumi_page::resolve_subject(bid).await) });
    }
    while let Some(res) = js.join_next().await {
        match res {
            Ok((bid, sid_res)) => {
                if let Ok(Some(s)) = sid_res {
                    if s == sid {
                        return Ok(Some(bid));
                    }
                }
            }
            Err(_) => {}
        }
        if idx < candidates.len() {
            let bid2 = candidates[idx];
            idx += 1;
            js.spawn(async move { (bid2, bangumi_page::resolve_subject(bid2).await) });
        }
    }
    Ok(None)
}

pub mod bangumi_page;
pub mod map_store;
pub mod rss;
pub mod search;
