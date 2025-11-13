//! src-tauri/src/services/bangumi_service.rs

use crate::error::AppError;
use crate::models::bangumi::CalendarResponse;

const BGM_API_HOST: &str = "https://api.bgm.tv";

pub async fn fetch_calendar() -> Result<Vec<CalendarResponse>, AppError> {
    let url = format!("{}/calendar", BGM_API_HOST);
    let response = reqwest::get(&url)
        .await?
        .json::<Vec<CalendarResponse>>()
        .await?;
    Ok(response)
}
