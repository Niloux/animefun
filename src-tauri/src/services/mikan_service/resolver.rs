use crate::error::AppError;
use crate::services::mikan_service::bangumi_page;
use tokio::task::JoinSet;

pub async fn resolve_candidates(
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

