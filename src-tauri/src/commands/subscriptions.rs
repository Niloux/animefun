use crate::{error::CommandResult, subscriptions, services::bangumi_service, models::bangumi::{SubjectResponse, SubjectStatusCode}};

fn status_order(code: &SubjectStatusCode) -> u8 {
    match code {
        SubjectStatusCode::Airing => 0,
        SubjectStatusCode::PreAir => 1,
        SubjectStatusCode::Finished => 2,
        SubjectStatusCode::OnHiatus => 3,
        SubjectStatusCode::Unknown => 4,
    }
}

#[derive(serde::Serialize, ts_rs::TS)]
#[ts(export, export_to = "../../src/types/gen/bangumi.ts")]
pub struct SubscriptionItem {
    pub id: u32,
    pub anime: SubjectResponse,
    #[ts(rename = "addedAt")]
    #[ts(type = "number")]
    pub added_at: i64,
    #[ts(optional)]
    pub notify: Option<bool>,
}

#[tauri::command]
pub async fn sub_list() -> CommandResult<Vec<SubscriptionItem>> {
    let rows = subscriptions::list().await?;
    let mut out = Vec::with_capacity(rows.len());
    for (id, added_at, notify) in rows.into_iter() {
        let key = format!("subject:{}", id);
        let anime = if let Some(s) = crate::cache::get(&key).await? {
            serde_json::from_str::<SubjectResponse>(&s)?
        } else {
            bangumi_service::fetch_subject(id).await?
        };
        out.push(SubscriptionItem { id, anime, added_at, notify: Some(notify) });
    }
    Ok(out)
}

#[tauri::command]
pub async fn sub_toggle(id: u32) -> CommandResult<bool> {
    Ok(subscriptions::toggle(id, None).await?)
}

#[tauri::command]
pub async fn sub_clear() -> CommandResult<()> {
    Ok(subscriptions::clear().await?)
}

#[derive(serde::Serialize, serde::Deserialize, ts_rs::TS)]
#[ts(export, export_to = "../../src/types/gen/bangumi.ts")]
pub struct SubQueryParams {
    pub keywords: Option<String>,
    pub sort: Option<String>,
    pub genres: Option<Vec<String>>, 
    pub min_rating: Option<f32>,
    pub max_rating: Option<f32>,
    pub status_code: Option<SubjectStatusCode>, 
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

#[tauri::command]
pub async fn sub_query(params: SubQueryParams) -> CommandResult<crate::models::bangumi::SearchResponse> {
    let rows = subscriptions::list().await?;
    let sort_needs_status = matches!(params.sort.as_deref(), Some("status"));
    let need_status = params.status_code.is_some() || sort_needs_status;
    let mut items: Vec<(SubjectResponse, Option<crate::models::bangumi::SubjectStatus>)> = Vec::new();
    for (id, _added_at, _notify) in rows.iter() {
        let key = format!("subject:{}", id);
        let anime = if let Some(s) = crate::cache::get(&key).await? {
            serde_json::from_str::<SubjectResponse>(&s)?
        } else {
            bangumi_service::fetch_subject(*id).await?
        };
        let status = if need_status { Some(subscriptions::get_status_cached(*id).await?) } else { None };
        items.push((anime, status));
    }
    let mut filtered_items: Vec<(SubjectResponse, Option<crate::models::bangumi::SubjectStatus>)> = items
        .into_iter()
        .filter(|(a, st)| {
            if let Some(k) = params.keywords.as_ref() {
                let q = k.trim().to_lowercase();
                if !q.is_empty() {
                    let n1 = a.name.to_lowercase();
                    let n2 = a.name_cn.to_lowercase();
                    if !n1.contains(&q) && !n2.contains(&q) {
                        return false;
                    }
                }
            }
            if let Some(gs) = params.genres.as_ref() {
                if !gs.is_empty() {
                    let mut tags: Vec<String> = Vec::new();
                    if let Some(t) = a.meta_tags.as_ref() {
                        tags.extend(t.iter().cloned());
                    }
                    if let Some(t) = a.tags.as_ref() {
                        tags.extend(t.iter().map(|x| x.name.clone()));
                    }
                    let set: std::collections::HashSet<String> = tags.into_iter().map(|x| x.to_lowercase()).collect();
                    for g in gs {
                        if !set.contains(&g.to_lowercase()) {
                            return false;
                        }
                    }
                }
            }
            if let Some(minr) = params.min_rating {
                if let Some(r) = a.rating.as_ref() {
                    if r.score < minr { return false; }
                } else {
                    return false;
                }
            }
            if let Some(maxr) = params.max_rating {
                if let Some(r) = a.rating.as_ref() {
                    if r.score > maxr { return false; }
                }
            }
            if let Some(code) = params.status_code.as_ref() {
                if let Some(s) = st.as_ref() {
                    if &s.code != code { return false; }
                } else {
                    return false;
                }
            }
            true
        })
        .collect();

    match params.sort.as_deref() {
        Some("status") => {
            filtered_items.sort_by(|(_, sa), (_, sb)| {
                let oa = sa.as_ref().map(|s| status_order(&s.code)).unwrap_or(5);
                let ob = sb.as_ref().map(|s| status_order(&s.code)).unwrap_or(5);
                oa.cmp(&ob)
            });
        }
        Some("rank") => {
            filtered_items.sort_by(|(a, _), (b, _)| {
                let ar = a.rating.as_ref().and_then(|r| r.rank).unwrap_or(u32::MAX);
                let br = b.rating.as_ref().and_then(|r| r.rank).unwrap_or(u32::MAX);
                ar.cmp(&br)
            });
        }
        Some("score") => {
            filtered_items.sort_by(|(a, _), (b, _)| {
                let ascore = a.rating.as_ref().map(|r| r.score).unwrap_or(0.0);
                let bscore = b.rating.as_ref().map(|r| r.score).unwrap_or(0.0);
                bscore.partial_cmp(&ascore).unwrap_or(std::cmp::Ordering::Equal)
            });
        }
        Some("heat") => {
            filtered_items.sort_by(|(a, _), (b, _)| {
                let atotal = a.rating.as_ref().map(|r| r.total).unwrap_or(0);
                let btotal = b.rating.as_ref().map(|r| r.total).unwrap_or(0);
                btotal.cmp(&atotal)
            });
        }
        Some("match") => {
            if let Some(k) = params.keywords.as_ref() {
                let q = k.trim().to_lowercase();
                filtered_items.sort_by(|(a, _), (b, _)| {
                    let n1 = a.name.to_lowercase();
                    let n2 = a.name_cn.to_lowercase();
                    let m_a = if n1.contains(&q) {2} else if n2.contains(&q) {1} else {0};
                    let n1b = b.name.to_lowercase();
                    let n2b = b.name_cn.to_lowercase();
                    let m_b = if n1b.contains(&q) {2} else if n2b.contains(&q) {1} else {0};
                    m_b.cmp(&m_a)
                });
            }
        }
        _ => {}
    }

    let total = filtered_items.len() as u32;
    let limit = params.limit.unwrap_or(20);
    let offset = params.offset.unwrap_or(0);
    let start = offset as usize;
    let data: Vec<SubjectResponse> = if start >= filtered_items.len() { Vec::new() } else { filtered_items.into_iter().skip(start).take(limit as usize).map(|(a, _)| a).collect() };

    Ok(crate::models::bangumi::SearchResponse { total, limit, offset, data })
}