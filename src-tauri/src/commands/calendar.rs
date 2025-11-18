//! src-tauri/src/commands/calendar.rs

use crate::{error::CommandResult, services::bangumi_service};

#[tauri::command]
pub async fn get_calendar() -> CommandResult<Vec<crate::models::bangumi::CalendarResponse>> {
    Ok(bangumi_service::fetch_calendar().await?)
}
