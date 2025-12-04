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
    // 检查持久化存储中的映射
    if let Some(mid) = map_store::get(sid).await? {
        return Ok(Some(mid));
    }

    let no_map_key = format!("mikan:no-map:{}", sid);

    // 检查缓存中是否存在"无映射"标记
    // TODO:后续应该要实现用户可以手动绑定映射的逻辑，但是该功能需求优先级较低，暂时不做
    if cache::get_entry(&no_map_key).await?.is_some() {
        return Ok(None);
    }

    // 执行映射逻辑
    let subject = bangumi::api::fetch_subject(sid).await?;
    let normalized_name = normalize_name(subject.name, subject.name_cn);
    let candidates = search::search_candidates(&normalized_name).await?;
    let resolved_id = resolver::resolve_candidates(sid, candidates, MAX_CONCURRENCY).await?;

    match resolved_id {
        Some(bid) => {
            // 映射成功，保存到持久化存储
            map_store::upsert(sid, bid, 1.0, "explicit", false).await?;
            Ok(Some(bid))
        }
        None => {
            // 映射失败或没有找到候选，设置"无映射"标记
            cache::set_entry(&no_map_key, "1".to_string(), None, None, NO_MAP_TTL_SECS).await?;
            Ok(None)
        }
    }
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
