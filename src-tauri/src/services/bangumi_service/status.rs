use crate::error::AppError;
use crate::models::bangumi::{Episode, SubjectStatus, SubjectStatusCode};
use chrono::{Days, NaiveDate, Utc};

use super::api::{fetch_calendar, fetch_episodes, fetch_subject};

const RECENT_WINDOW_DAYS: u64 = 21;

fn parse_date(s: &str) -> Option<NaiveDate> {
    NaiveDate::parse_from_str(s, "%Y-%m-%d").ok()
}

fn latest_episode_airdate(episodes: &[Episode]) -> Option<String> {
    let ep = episodes.iter().filter(|e| e.item_type == 0).max_by(|a, b| {
        a.sort
            .partial_cmp(&b.sort)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    ep.map(|e| e.airdate.clone()).filter(|d| !d.is_empty())
}

fn within_window(date: Option<NaiveDate>, window_start: NaiveDate) -> bool {
    match date {
        Some(d) => d >= window_start,
        None => false,
    }
}

fn is_finished(expected_eps: Option<u32>, current_eps: Option<u32>) -> bool {
    match (expected_eps, current_eps) {
        (Some(exp), Some(cur)) if exp > 0 && cur >= exp => true,
        _ => false,
    }
}

fn determine_code(
    first_air: Option<NaiveDate>,
    latest_air: Option<NaiveDate>,
    calendar_on_air: bool,
    finished: bool,
    today: NaiveDate,
    window_start: NaiveDate,
) -> SubjectStatusCode {
    match first_air {
        Some(fa) if fa > today => SubjectStatusCode::PreAir,
        Some(_) => {
            if calendar_on_air {
                SubjectStatusCode::Airing
            } else if finished {
                SubjectStatusCode::Finished
            } else if within_window(latest_air, window_start) {
                SubjectStatusCode::Airing
            } else {
                SubjectStatusCode::OnHiatus
            }
        }
        None => {
            if calendar_on_air {
                SubjectStatusCode::Airing
            } else if finished {
                SubjectStatusCode::Finished
            } else if within_window(latest_air, window_start) {
                SubjectStatusCode::Airing
            } else {
                SubjectStatusCode::Unknown
            }
        }
    }
}

fn status_reason(code: &SubjectStatusCode, calendar_on_air: bool) -> String {
    match code {
        SubjectStatusCode::PreAir => "未开播".to_string(),
        SubjectStatusCode::Airing => {
            if calendar_on_air {
                "当周日历在播".to_string()
            } else {
                "最近三周有更新".to_string()
            }
        }
        SubjectStatusCode::Finished => "集数达成".to_string(),
        SubjectStatusCode::OnHiatus => "超过三周未更新".to_string(),
        SubjectStatusCode::Unknown => "信息不足".to_string(),
    }
}

pub async fn calc_subject_status(id: u32) -> Result<SubjectStatus, AppError> {
    let (subject_res, calendar_res, initial_eps_res) = tokio::join!(
        fetch_subject(id),
        fetch_calendar(),
        // 直接按最大数取，减少超长篇动画的剧集请求次数
        fetch_episodes(id, None, Some(1000), Some(0)),
    );
    let subject = subject_res?;
    let calendar = calendar_res?;
    let calendar_on_air = calendar
        .iter()
        .any(|day| day.items.iter().any(|item| item.id == id));
    let first_air_date: Option<String> = subject.date.clone();
    let expected_eps: Option<u32> = subject.eps;
    let mut current_eps: Option<u32> = subject.total_episodes;
    let mut latest_airdate: Option<String> = None;
    let initial_eps = initial_eps_res?;
    if current_eps.is_none() {
        current_eps = Some(initial_eps.total);
    }
    if initial_eps.total > 0 {
        let limit = initial_eps.limit.max(1);
        let total = initial_eps.total;
        let offset_last = ((total.saturating_sub(1)) / limit) * limit;
        let last_page = if offset_last == initial_eps.offset {
            initial_eps
        } else {
            fetch_episodes(id, None, Some(limit), Some(offset_last)).await?
        };
        latest_airdate = latest_episode_airdate(&last_page.data);
    }
    let today = Utc::now().date_naive();
    let window_start = today
        .checked_sub_days(Days::new(RECENT_WINDOW_DAYS))
        .unwrap_or(today);
    let first_air = first_air_date.as_ref().and_then(|d| parse_date(d));
    let latest_air = latest_airdate.as_ref().and_then(|d| parse_date(d));
    let finished = is_finished(expected_eps, current_eps);
    let code = determine_code(
        first_air,
        latest_air,
        calendar_on_air,
        finished,
        today,
        window_start,
    );
    let reason = status_reason(&code, calendar_on_air);
    Ok(SubjectStatus {
        code,
        first_air_date,
        latest_airdate,
        expected_eps,
        current_eps,
        calendar_on_air,
        reason,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::bangumi_service::api::{
        fetch_episodes as feps, fetch_subject as fsub, search_subject as ssub,
    };

    #[tokio::test]
    async fn test_fetch_subject() {
        let res = fsub(12381).await.unwrap();
        assert_eq!(res.id, 12381);
        assert!(!res.name.is_empty());
    }

    #[tokio::test]
    async fn test_search_subject() {
        let res = ssub(
            "Fate",
            Some(vec![2]),
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            Some(10),
            Some(0),
        )
        .await
        .unwrap();
        assert!(res.total > 0);
        assert!(!res.data.is_empty());
        let first = &res.data[0];
        assert!(first.id > 0);
        assert!(!first.name.is_empty());
    }

    #[tokio::test]
    async fn test_fetch_episodes() {
        let res = feps(876, None, Some(100), Some(0)).await.unwrap();
        assert!(res.limit >= 1);
        assert!(res.data.len() as u32 <= res.limit);
    }

    #[tokio::test]
    async fn test_calc_subject_status_returns_any_code() {
        let res = calc_subject_status(12381).await.unwrap();
        match res.code {
            SubjectStatusCode::PreAir
            | SubjectStatusCode::Airing
            | SubjectStatusCode::Finished
            | SubjectStatusCode::OnHiatus
            | SubjectStatusCode::Unknown => {}
        }
    }
}
