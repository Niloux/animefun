use crate::error::AppError;
use crate::infra::cache;
use crate::models::mikan::{MikanResourceItem, MikanResourcesResponse};
use crate::services::bangumi;
use std::path::PathBuf;

const MAX_CONCURRENCY: usize = 5;
const NO_MAP_TTL_SECS: i64 = 3600;

pub fn init(base_dir: PathBuf) -> Result<(), AppError> {
    map_store::init(base_dir)
}

use crate::services::mikan::util::normalize_name;

pub async fn ensure_map(sid: u32) -> Result<Option<u32>, AppError> {
    if let Some(mid) = map_store::get(sid).await? {
        return Ok(Some(mid));
    }
    let no_key = format!("mikan:no-map:{}", sid);
    if cache::get_entry(&no_key).await?.is_some() {
        return Ok(None);
    }
    let subject = bangumi::api::fetch_subject(sid).await?;
    let name = normalize_name(subject.name, subject.name_cn);
    let candidates = search::search_candidates(&name).await?;
    if candidates.is_empty() {
        cache::set_entry(&no_key, "1".to_string(), None, None, NO_MAP_TTL_SECS).await?;
        return Ok(None);
    }
    let res = resolver::resolve_candidates(sid, candidates, MAX_CONCURRENCY).await?;
    if let Some(bid) = res {
        map_store::upsert(sid, bid, 1.0, "explicit", false).await?;
        return Ok(Some(bid));
    }
    cache::set_entry(&no_key, "1".to_string(), None, None, NO_MAP_TTL_SECS).await?;
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

pub use preheat::spawn_preheat_worker;

pub mod preheat;
pub mod resolver;
pub mod util;

pub mod bangumi_page;
pub mod map_store;
pub mod rss;
pub mod search;
