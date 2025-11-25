use crate::error::AppError;
use crate::models::bangumi::SubjectResponse;

pub async fn list_ids() -> Result<Vec<u32>, AppError> {
    crate::subscriptions::repo::list_ids().await
}

pub async fn has(id: u32) -> Result<bool, AppError> {
    crate::subscriptions::repo::has(id).await
}

pub async fn clear() -> Result<(), AppError> {
    crate::subscriptions::repo::clear().await?;
    crate::subscriptions::index_repo::index_clear().await
}

pub async fn toggle(id: u32, notify: Option<bool>) -> Result<bool, AppError> {
    let exists = crate::subscriptions::repo::has(id).await?;
    if exists {
        crate::subscriptions::repo::remove(id).await?;
        tauri::async_runtime::spawn(async move {
            let _ = crate::subscriptions::index_repo::index_delete(id).await;
        });
        Ok(false)
    } else {
        let n = notify.unwrap_or(false);
        crate::subscriptions::repo::add(id, n).await?;
        tauri::async_runtime::spawn(async move {
            let subject = crate::services::bangumi_service::fetch_subject(id)
                .await
                .ok();
            let status = crate::subscriptions::get_status_cached(id).await.ok();
            if let (Some(sj), Some(st)) = (subject, status) {
                let _ = crate::subscriptions::index_repo::index_upsert(
                    id,
                    crate::infra::time::now_secs(),
                    sj,
                    st.code,
                )
                .await;
            }
        });
        Ok(true)
    }
}

pub async fn list_full() -> Result<Vec<(u32, i64, bool, SubjectResponse)>, AppError> {
    crate::subscriptions::index_repo::list_full().await
}

pub async fn query_full(
    params: crate::commands::subscriptions::SubQueryParams,
) -> Result<(Vec<SubjectResponse>, u32), AppError> {
    crate::subscriptions::index_repo::query_full(params).await
}
