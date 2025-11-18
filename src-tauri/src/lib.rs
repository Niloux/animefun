// src-tauri/src/lib.rs

use tauri::Manager;
mod commands;
mod cache;
mod error;
mod models;
mod services;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let base = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| {
                    let home = std::env::var("HOME").unwrap_or_else(|_| ".".into());
                    std::path::PathBuf::from(home).join(".animefun")
                });
            cache::init(base).map_err(|e| e.to_string())?;
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::calendar::get_calendar,
            commands::episodes::get_episodes,
            commands::subject::get_subject,
            commands::search::search_subject,
            commands::cache::cache_image,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
