mod commands;
mod error;
mod infra;
mod models;
mod services;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            crate::infra::log::init();
            let base = crate::infra::path::app_base_dir(app.handle());
            crate::infra::cache::init(base.clone())
                .map_err(|e| -> Box<dyn std::error::Error> { Box::new(e) })?;
            crate::services::subscriptions::init(base.clone())
                .map_err(|e| -> Box<dyn std::error::Error> { Box::new(e) })?;
            crate::services::mikan::init(base.clone())
                .map_err(|e| -> Box<dyn std::error::Error> { Box::new(e) })?;
            tauri::async_runtime::spawn(crate::commands::cache::cleanup_images(
                app.handle().clone(),
            ));
            crate::services::subscriptions::spawn_refresh_worker();
            crate::services::mikan::spawn_preheat_worker();

            // 下载服务
            let downloader_service = crate::services::downloader::service::DownloaderService::new();
            downloader_service.start_sync_loop(app.handle().clone());
            app.manage(downloader_service);

            // 启动侧车
            crate::services::downloader::manager::SidecarManager::start(app.handle());

            Ok(())
        })
        .on_window_event(|window, event| match event {
            tauri::WindowEvent::CloseRequested { .. } => {
                crate::services::downloader::manager::SidecarManager::stop(&window.app_handle());
            }
            tauri::WindowEvent::Destroyed => {
                crate::services::downloader::manager::SidecarManager::stop(&window.app_handle());
            }
            _ => {}
        })
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
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
            commands::subscriptions::sub_query,
            commands::mikan::get_mikan_resources,
            commands::download::download_add,
            commands::download::download_list,
            commands::download::download_pause,
            commands::download::download_resume,
            commands::download::download_delete,
            commands::download::download_health,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
