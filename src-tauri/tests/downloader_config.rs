use animefun_lib::error::AppError;
use animefun_lib::services::downloader::config::{get_config, save_config, DownloaderConfig};
use std::time::{SystemTime, UNIX_EPOCH};

fn unique_home(suffix: &str) -> String {
    let mut base = std::env::temp_dir();
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    base.push(format!("animefun-config-tests-{}-{}", suffix, nanos));
    base.to_string_lossy().to_string()
}

#[tokio::test]
async fn test_downloader_config_default_and_save() -> Result<(), AppError> {
    let prev = std::env::var("HOME").ok();
    std::env::set_var("HOME", unique_home("default"));

    let cfg = get_config().await?;
    assert_eq!(cfg.api_url, "http://localhost:8080");
    assert_eq!(cfg.username.as_deref(), Some("admin"));
    assert_eq!(cfg.password.as_deref(), Some("adminadmin"));

    let new_cfg = DownloaderConfig {
        api_url: "http://127.0.0.1:18080".into(),
        username: Some("u".into()),
        password: None,
    };
    save_config(new_cfg.clone()).await?;

    let got = get_config().await?;
    assert_eq!(got.api_url, new_cfg.api_url);
    assert_eq!(got.username, new_cfg.username);
    assert_eq!(got.password, new_cfg.password);

    if let Some(p) = prev {
        std::env::set_var("HOME", p);
    }
    Ok(())
}
