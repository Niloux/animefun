// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

mod bangumi;
use bangumi::{
    BangumiClient, DailyCalendar, EpisodesResult, SearchResult, SubjectDetail,
};

#[tauri::command]
async fn bgm_daily(
    client: tauri::State<'_, BangumiClient>,
) -> Result<DailyCalendar, String> {
    client.get_calendar().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn bgm_subject(
    id: u32,
    client: tauri::State<'_, BangumiClient>,
) -> Result<SubjectDetail, String> {
    client.get_subject(id).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn bgm_search(
    keyword: String,
    r#type: Option<u8>,
    limit: Option<u32>,
    offset: Option<u32>,
    client: tauri::State<'_, BangumiClient>,
) -> Result<SearchResult, String> {
    client.search_subjects(&keyword, r#type, limit, offset).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn bgm_episodes(
    subject_id: u32,
    limit: Option<u32>,
    offset: Option<u32>,
    client: tauri::State<'_, BangumiClient>,
) -> Result<EpisodesResult, String> {
    client.get_episodes(subject_id, limit, offset).await.map_err(|e| e.to_string())
}
