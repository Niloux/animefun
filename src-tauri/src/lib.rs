mod commands;
pub mod error;
pub mod infra;
mod models;
pub mod services;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            crate::infra::log::init();
            crate::infra::notification::init(app.handle().clone());
            let base = crate::infra::path::app_base_dir(app.handle());
            tauri::async_runtime::block_on(async move {
                crate::infra::db::init_pools(base.clone())
                    .await
                    .map_err(|e| -> Box<dyn std::error::Error> { Box::new(e) })
            })?;
            tauri::async_runtime::spawn(crate::commands::cache::cleanup_images(
                app.handle().clone(),
            ));
            crate::services::subscriptions::spawn_refresh_worker();
            crate::services::mikan::spawn_preheat_worker();
            crate::services::downloader::monitor::spawn_status_monitor(app.handle().clone());

            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            commands::bangumi::get_calendar,
            commands::bangumi::get_episodes,
            commands::bangumi::get_subject,
            commands::bangumi::get_subject_status,
            commands::bangumi::search_subject,
            commands::cache::cache_image,
            commands::subscriptions::sub_list,
            commands::subscriptions::sub_list_ids,
            commands::subscriptions::sub_toggle,
            commands::subscriptions::sub_has,
            commands::subscriptions::sub_clear,
            commands::subscriptions::sub_set_notify,
            commands::subscriptions::send_test_notification,
            commands::subscriptions::sub_query,
            commands::mikan::get_mikan_resources,
            commands::downloader::get_downloader_config,
            commands::downloader::set_downloader_config,
            commands::downloader::test_downloader_connection,
            commands::downloader::add_torrent_and_track,
            commands::downloader::get_tracked_downloads,
            commands::downloader::get_live_download_info,
            commands::downloader::pause_download,
            commands::downloader::resume_download,
            commands::downloader::delete_download,
            commands::downloader::open_download_folder,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
