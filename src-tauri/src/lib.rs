// src-tauri/src/lib.rs

mod commands;
mod cache;
mod error;
mod models;
mod services;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::calendar::get_calendar,
            commands::episodes::get_episodes,
            commands::subject::get_subject,
            commands::search::search_subject,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
