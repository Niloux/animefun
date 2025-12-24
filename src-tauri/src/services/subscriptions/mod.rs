pub mod index_repo;
pub mod repo;
pub mod status;
pub mod worker;

pub use status::get_status_cached;

pub use worker::spawn_refresh_worker;

use crate::error::AppError;
use crate::models::bangumi::SubjectResponse;

pub use index_repo::{batch_get_metadata, SubjectMetadata};

pub async fn list_ids() -> Result<Vec<u32>, AppError> {
    repo::list_ids().await
}

pub async fn has(id: u32) -> Result<bool, AppError> {
    repo::has(id).await
}

pub async fn clear() -> Result<(), AppError> {
    repo::clear().await?;
    index_repo::index_clear().await
}

pub async fn toggle(id: u32, notify: Option<bool>) -> Result<bool, AppError> {
    let exists = repo::has(id).await?;
    if exists {
        repo::remove(id).await?;
        index_repo::index_delete(id).await?;
        Ok(false)
    } else {
        let n = notify.unwrap_or(false);
        repo::add(id, n).await?;
        let sj = crate::services::bangumi::fetch_subject(id).await?;
        let st = get_status_cached(id).await?;
        index_repo::index_upsert(id, crate::infra::time::now_secs(), sj, st.code).await?;
        Ok(true)
    }
}

pub async fn list_full() -> Result<Vec<(u32, i64, bool, SubjectResponse)>, AppError> {
    index_repo::list_full().await
}

pub async fn query_full(
    params: crate::commands::subscriptions::SubQueryParams,
) -> Result<(Vec<SubjectResponse>, u32), AppError> {
    index_repo::query_full(params).await
}
