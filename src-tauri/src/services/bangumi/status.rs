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
    matches!((expected_eps, current_eps), (Some(exp), Some(cur)) if exp > 0 && cur >= exp)
}

fn determine_code(
    first_air: Option<NaiveDate>,
    latest_air: Option<NaiveDate>,
    calendar_on_air: bool,
    finished: bool,
    today: NaiveDate,
    window_start: NaiveDate,
) -> SubjectStatusCode {
    let pre_air = first_air.map(|d| d > today).unwrap_or(false);
    let recently_updated = within_window(latest_air, window_start);

    if pre_air {
        SubjectStatusCode::PreAir
    } else if finished {
        SubjectStatusCode::Finished
    } else if calendar_on_air || recently_updated {
        SubjectStatusCode::Airing
    } else if first_air.is_some() {
        SubjectStatusCode::OnHiatus
    } else {
        SubjectStatusCode::Unknown
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
    let (subject_res, calendar_res) = tokio::join!(fetch_subject(id), fetch_calendar(),);
    let subject = subject_res?;
    let calendar = calendar_res?;
    let calendar_on_air = calendar
        .iter()
        .any(|day| day.items.iter().any(|item| item.id == id));
    let first_air_date: Option<String> = subject.date.clone();
    let expected_eps: Option<u32> = subject.eps;
    let mut current_eps: Option<u32> = subject.total_episodes;
    let mut latest_airdate: Option<String> = None;

    let today = Utc::now().date_naive();
    let window_start = today
        .checked_sub_days(Days::new(RECENT_WINDOW_DAYS))
        .unwrap_or(today);
    let first_air = first_air_date.as_ref().and_then(|d| parse_date(d));

    let pre_air = matches!(first_air, Some(fa) if fa > today);
    if !pre_air && !calendar_on_air {
        if current_eps.is_none() && expected_eps.is_some() {
            let first_page = fetch_episodes(id, Some(0), Some(1), Some(0)).await?;
            current_eps = Some(first_page.total);
        }
        let finished = is_finished(expected_eps, current_eps);
        if !finished {
            let total_norm = if let Some(n) = current_eps {
                n
            } else {
                let fp = fetch_episodes(id, Some(0), Some(1), Some(0)).await?;
                fp.total
            };
            if total_norm > 0 {
                let offset_last = total_norm.saturating_sub(1);
                let last_page = fetch_episodes(id, Some(0), Some(1), Some(offset_last)).await?;
                latest_airdate = latest_episode_airdate(&last_page.data);
            }
        }
    }

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
    use crate::services::bangumi::api::{
        fetch_episodes as feps, fetch_subject as fsub, search_subject as ssub,
    };

    fn date(s: &str) -> NaiveDate {
        NaiveDate::parse_from_str(s, "%Y-%m-%d").unwrap()
    }

    fn episode(item_type: u8, sort: f32, airdate: &str) -> Episode {
        Episode {
            id: sort as u32,
            item_type,
            name: format!("ep-{sort}"),
            name_cn: String::new(),
            sort,
            ep: Some(sort),
            airdate: airdate.to_string(),
            comment: 0,
            duration: String::new(),
            desc: String::new(),
            disc: 0,
            duration_seconds: None,
            subject_id: None,
        }
    }

    fn live_bangumi_enabled() -> bool {
        std::env::var("RUN_LIVE_BANGUMI_TESTS").as_deref() == Ok("1")
    }

    async fn init_live_test_env() {
        let base = std::env::temp_dir().join("animefun-tests");
        let _ = crate::infra::db::init_pools(base).await;
    }

    #[test]
    fn determines_pre_air_when_first_air_is_future() {
        let code = determine_code(
            Some(date("2026-04-01")),
            None,
            false,
            false,
            date("2026-03-01"),
            date("2026-02-08"),
        );

        assert!(matches!(code, SubjectStatusCode::PreAir));
    }

    #[test]
    fn determines_finished_when_episode_count_reaches_expected() {
        let code = determine_code(
            Some(date("2026-01-01")),
            None,
            false,
            true,
            date("2026-03-01"),
            date("2026-02-08"),
        );

        assert!(matches!(code, SubjectStatusCode::Finished));
    }

    #[test]
    fn determines_airing_when_calendar_has_subject() {
        let code = determine_code(
            Some(date("2026-01-01")),
            None,
            true,
            false,
            date("2026-03-01"),
            date("2026-02-08"),
        );

        assert!(matches!(code, SubjectStatusCode::Airing));
        assert_eq!(status_reason(&code, true), "当周日历在播");
    }

    #[test]
    fn determines_airing_when_latest_episode_is_recent() {
        let code = determine_code(
            Some(date("2026-01-01")),
            Some(date("2026-02-20")),
            false,
            false,
            date("2026-03-01"),
            date("2026-02-08"),
        );

        assert!(matches!(code, SubjectStatusCode::Airing));
        assert_eq!(status_reason(&code, false), "最近三周有更新");
    }

    #[test]
    fn determines_hiatus_when_air_date_exists_without_recent_update() {
        let code = determine_code(
            Some(date("2026-01-01")),
            Some(date("2026-01-15")),
            false,
            false,
            date("2026-03-01"),
            date("2026-02-08"),
        );

        assert!(matches!(code, SubjectStatusCode::OnHiatus));
    }

    #[test]
    fn determines_unknown_when_dates_are_missing() {
        let code = determine_code(
            None,
            None,
            false,
            false,
            date("2026-03-01"),
            date("2026-02-08"),
        );

        assert!(matches!(code, SubjectStatusCode::Unknown));
    }

    #[test]
    fn detects_finished_only_when_expected_episode_count_is_positive_and_reached() {
        assert!(is_finished(Some(12), Some(12)));
        assert!(is_finished(Some(12), Some(13)));
        assert!(!is_finished(Some(12), Some(11)));
        assert!(!is_finished(Some(0), Some(1)));
        assert!(!is_finished(Some(12), None));
    }

    #[test]
    fn latest_episode_airdate_uses_main_episode_with_highest_sort() {
        let episodes = vec![
            episode(0, 1.0, "2026-01-01"),
            episode(1, 99.0, "2026-12-31"),
            episode(0, 2.0, "2026-01-08"),
        ];

        assert_eq!(
            latest_episode_airdate(&episodes).as_deref(),
            Some("2026-01-08")
        );
    }

    #[test]
    fn latest_episode_airdate_ignores_empty_airdate() {
        let episodes = vec![episode(0, 1.0, "")];

        assert!(latest_episode_airdate(&episodes).is_none());
    }

    #[ignore]
    #[tokio::test]
    async fn live_fetch_subject() {
        if !live_bangumi_enabled() {
            return;
        }
        init_live_test_env().await;
        let res = fsub(12381).await.unwrap();
        assert_eq!(res.id, 12381);
        assert!(!res.name.is_empty());
    }

    #[ignore]
    #[tokio::test]
    async fn live_search_subject() {
        if !live_bangumi_enabled() {
            return;
        }
        init_live_test_env().await;
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

    #[ignore]
    #[tokio::test]
    async fn live_fetch_episodes() {
        if !live_bangumi_enabled() {
            return;
        }
        init_live_test_env().await;
        let res = feps(876, None, Some(100), Some(0)).await.unwrap();
        assert!(res.limit >= 1);
        assert!(res.data.len() as u32 <= res.limit);
    }

    #[ignore]
    #[tokio::test]
    async fn live_calc_subject_status_returns_any_code() {
        if !live_bangumi_enabled() {
            return;
        }
        init_live_test_env().await;
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
