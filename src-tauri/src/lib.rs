// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

mod bangumi;
use bangumi::{DailyBroadcast, EpisodesPage, SubjectDetail, SubjectsPage};

#[tauri::command]
async fn bgm_daily(token: Option<String>) -> Result<DailyBroadcast, String> {
    let c = bangumi::BangumiClient::new(token);
    c.daily().await
}

#[tauri::command]
async fn bgm_subject(id: u32, token: Option<String>) -> Result<SubjectDetail, String> {
    let c = bangumi::BangumiClient::new(token);
    c.subject(id).await
}

#[tauri::command]
async fn bgm_search(
    q: String,
    r#type: Option<u8>,
    limit: Option<u32>,
    offset: Option<u32>,
    token: Option<String>,
) -> Result<SubjectsPage, String> {
    let c = bangumi::BangumiClient::new(token);
    c.search(&q, r#type, limit, offset).await
}

#[tauri::command]
async fn bgm_episodes(
    subject_id: u32,
    limit: Option<u32>,
    offset: Option<u32>,
    token: Option<String>,
) -> Result<EpisodesPage, String> {
    let c = bangumi::BangumiClient::new(token);
    c.episodes(subject_id, limit, offset).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            bgm_daily,
            bgm_subject,
            bgm_search,
            bgm_episodes
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
