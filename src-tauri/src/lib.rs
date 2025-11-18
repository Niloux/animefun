// src-tauri/src/lib.rs

mod commands;
mod cache;
mod error;
mod models;
mod services;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let base = cache::app_base_dir(&app.handle());
            cache::init(base).map_err(|e| e.to_string())?;
            let _ = tauri::async_runtime::spawn(crate::commands::cache::cleanup_images(app.handle().clone()));
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
