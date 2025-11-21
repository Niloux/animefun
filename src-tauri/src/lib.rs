// src-tauri/src/lib.rs

mod cache;
mod commands;
mod error;
mod infra;
mod models;
mod services;
mod subscriptions;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            crate::infra::log::init();
            let base = crate::infra::path::app_base_dir(app.handle());
            cache::init(base).map_err(|e| e.to_string())?;
            let base2 = crate::infra::path::app_base_dir(app.handle());
            subscriptions::init(base2).map_err(|e| e.to_string())?;
            let base3 = crate::infra::path::app_base_dir(app.handle());
            crate::services::mikan_service::init(base3).map_err(|e| e.to_string())?;
            tauri::async_runtime::spawn(crate::commands::cache::cleanup_images(
                app.handle().clone(),
            ));
            subscriptions::spawn_refresh_worker();
            crate::services::mikan_service::spawn_preheat_worker();
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::calendar::get_calendar,
            commands::episodes::get_episodes,
            commands::subject::get_subject,
            commands::subject::get_subject_status,
            commands::search::search_subject,
            commands::cache::cache_image,
            commands::subscriptions::sub_list,
            commands::subscriptions::sub_list_ids,
            commands::subscriptions::sub_toggle,
            commands::subscriptions::sub_has,
            commands::subscriptions::sub_clear,
            commands::subscriptions::sub_query,
            commands::mikan::get_mikan_resources,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
