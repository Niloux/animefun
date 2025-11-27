use crate::infra::cache;
use crate::error::AppError;
use crate::models::bangumi::{SubjectStatus, SubjectStatusCode};

fn status_ttl_secs(code: &SubjectStatusCode) -> i64 {
    match code {
        SubjectStatusCode::Airing => 6 * 3600,
        SubjectStatusCode::PreAir => 24 * 3600,
        SubjectStatusCode::Finished => 7 * 24 * 3600,
        SubjectStatusCode::OnHiatus => 24 * 3600,
        SubjectStatusCode::Unknown => 24 * 3600,
    }
}

pub async fn get_status_cached(id: u32) -> Result<SubjectStatus, AppError> {
    let key = format!("sub:status:{}", id);
    if let Some((s, _, _)) = cache::get_entry(&key).await? {
        let v: SubjectStatus = serde_json::from_str(&s)?;
        return Ok(v);
    }
    let v = crate::services::bangumi::calc_subject_status(id).await?;
    if let Ok(s) = serde_json::to_string(&v) {
        let ttl = status_ttl_secs(&v.code);
        let _ = cache::set_entry(&key, s, None, None, ttl).await;
    }
    Ok(v)
}

