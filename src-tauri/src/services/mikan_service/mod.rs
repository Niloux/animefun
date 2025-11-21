use crate::error::AppError;
use crate::models::mikan::{MikanResourceItem, MikanResourcesResponse};
use crate::services::bangumi_service;
use std::path::PathBuf;
use tokio::task::JoinSet;

const MAX_CONCURRENCY: usize = 3;

pub fn init(base_dir: PathBuf) -> Result<(), AppError> {
    map_store::init(base_dir)
}

pub async fn ensure_mapping(subject_id: u32) -> Result<Option<u32>, AppError> {
    if let Some(mid) = map_store::get(subject_id).await? {
        return Ok(Some(mid));
    }
    let subject = bangumi_service::api::fetch_subject(subject_id).await?;
    let name = if subject.name_cn.trim().is_empty() {
        subject.name
    } else {
        let mut s = subject.name_cn.trim().to_string();
        let trims: [char; 8] = ['。', '.', '!', '！', '?', '？', '·', '•'];
        s = s.trim_end_matches(&trims[..]).to_string();
        s
    };
    let candidates = search::search_bangumi_candidates_by_name(&name).await?;
    if candidates.is_empty() {
        return Ok(None);
    }
    let mut js: JoinSet<(u32, Result<Option<u32>, AppError>)> = JoinSet::new();
    let mut idx = 0usize;
    let max_concurrency = MAX_CONCURRENCY;
    while idx < candidates.len() && js.len() < max_concurrency {
        let bid = candidates[idx];
        idx += 1;
        js.spawn(async move { (bid, bangumi_page::resolve_subject_explicit(bid).await) });
    }
    while let Some(res) = js.join_next().await {
        match res {
            Ok((bid, sid_res)) => {
                if let Ok(Some(sid)) = sid_res {
                    if sid == subject_id {
                        map_store::upsert(subject_id, bid, 1.0, "explicit", false).await?;
                        return Ok(Some(bid));
                    }
                }
            }
            Err(_) => {}
        }
        if idx < candidates.len() {
            let bid2 = candidates[idx];
            idx += 1;
            js.spawn(async move { (bid2, bangumi_page::resolve_subject_explicit(bid2).await) });
        }
    }
    Ok(None)
}

pub async fn get_mikan_resources(subject_id: u32) -> Result<MikanResourcesResponse, AppError> {
    let mut mid = map_store::get(subject_id).await?;
    if mid.is_none() {
        mid = ensure_mapping(subject_id).await?;
    }
    if let Some(mikan_id) = mid {
        let items: Vec<MikanResourceItem> = rss::fetch_bangumi_rss(mikan_id).await?;
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

pub mod bangumi_page;
pub mod map_store;
pub mod rss;
pub mod search;
