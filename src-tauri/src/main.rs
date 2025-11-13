// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod bangumi;

fn main() {
    // 创建 BangumiClient 实例并作为状态托管
    let bangumi_client = bangumi::BangumiClient::new(None).unwrap();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        // 管理 BangumiClient 状态
        .manage(bangumi_client)
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
