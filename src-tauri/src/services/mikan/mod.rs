use crate::error::AppError;
use crate::infra::cache;
use crate::models::mikan::{MikanResourceItem, MikanResourcesResponse};
use crate::services::bangumi;

const MAX_CONCURRENCY: usize = 5;
const NO_MAP_TTL_SECS: i64 = 3600;

use crate::utils::string::{
    generate_search_terms_by_stripping, normalize_name, replace_and_split,
};
use std::collections::HashSet;

/// 生成降级搜索词
fn generate_search_terms(name: &str) -> Vec<String> {
    let mut terms_set = HashSet::new();

    // Level 0: 原始标题
    terms_set.insert(name.to_string());

    // Level 1+: 符号替换 + 逐步剔除
    let words = replace_and_split(name);
    let stripped_terms = generate_search_terms_by_stripping(&words);
    terms_set.extend(stripped_terms);

    // 转换为 Vec 并按长度降序排序（优先尝试更精确的搜索词）
    let mut terms: Vec<_> = terms_set.into_iter().collect();
    terms.sort_by_key(|s| std::cmp::Reverse(s.len()));
    terms
}

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

    let subject = bangumi::api::fetch_subject(sid).await?;
    let normalized_name = normalize_name(&subject.name, &subject.name_cn);

    tracing::debug!("Searching for Mikan ID: {}", normalized_name);

    // 生成降级搜索词（原始 → 符号替换 → 逐步剔除）
    let search_terms = generate_search_terms(&normalized_name);
    tracing::debug!(
        "Generated {} search terms: {:?}",
        search_terms.len(),
        search_terms
    );

    // 依次尝试每一级，直到 resolver 成功才停止
    let mut resolved_id = None;
    for term in &search_terms {
        let candidates = search::search_candidates(term).await?;
        tracing::debug!("Search '{}' found {} candidates", term, candidates.len());

        if !candidates.is_empty() {
            match resolver::resolve_candidates(sid, candidates, MAX_CONCURRENCY).await? {
                Some(id) => {
                    tracing::info!("Successfully mapped to Mikan ID: {}", id);
                    resolved_id = Some(id);
                    break;
                }
                None => {
                    tracing::debug!("Candidates found but none matched, trying next...");
                    continue;
                }
            }
        }
    }

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

pub mod bangumi_page;
pub mod map_store;
pub mod rss;
pub mod search;
