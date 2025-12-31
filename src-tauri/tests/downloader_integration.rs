use std::time::Duration;

use animefun_lib::error::AppError;
use animefun_lib::services::downloader::client::{calculate_info_hash, QbitClient};
use animefun_lib::services::downloader::config::DownloaderConfig;
use animefun_lib::services::downloader::repo;

fn test_conf() -> DownloaderConfig {
    DownloaderConfig {
        api_url: "http://localhost:8080".to_string(),
        username: Some("admin".to_string()),
        password: Some("adminadmin".to_string()),
    }
}

fn delay_ms() -> u64 {
    std::env::var("QBIT_TEST_DELAY_MS")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(1500)
}

fn is_paused_state(s: &str) -> bool {
    let t = s.to_lowercase();
    t.contains("paused") || t == "stopped"
}

async fn server_available(base: &str) -> bool {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(3))
        .build()
        .unwrap();
    client
        .get(format!("{}/api/v2/app/version", base))
        .send()
        .await
        .map(|r| r.status().is_success())
        .unwrap_or(false)
}

#[tokio::test]
async fn test_qbit_add_pause_resume_delete() -> Result<(), AppError> {
    let conf = test_conf();
    if !server_available(&conf.api_url).await {
        return Ok(());
    }

    let mut qb = QbitClient::new(conf);
    qb.login().await?;

    let url =
        "https://mikanani.me/Download/20251126/004d19b0b3ab72b5b22ffa6bd39a98c0e45f4281.torrent";
    let bytes = reqwest::get(url).await?.bytes().await?.to_vec();
    let hash = calculate_info_hash(&bytes)?;

    qb.add_torrent(bytes).await?;

    let mut found = false;
    for _ in 0..10 {
        let infos = qb.get_torrents_info(vec![hash.clone()]).await?;
        if !infos.is_empty() {
            assert_eq!(infos[0].hash.to_lowercase(), hash.to_lowercase());
            found = true;
            break;
        }
        tokio::time::sleep(Duration::from_millis(300)).await;
    }
    assert!(found);

    let before = qb.get_torrents_info(vec![hash.clone()]).await?;
    if let Some(info) = before.get(0) {
        println!(
            "before: {} {} {:.2}% {}B/s",
            info.hash,
            info.state,
            info.progress * 100.0,
            info.dlspeed
        );
    }

    tokio::time::sleep(Duration::from_millis(delay_ms())).await;
    let _ = qb.pause(&hash).await;
    tokio::time::sleep(Duration::from_millis(delay_ms())).await;
    let mut ok_paused = false;
    for _ in 0..10 {
        let paused = qb.get_torrents_info(vec![hash.clone()]).await?;
        if let Some(info) = paused.get(0) {
            println!(
                "paused: {} {} {:.2}% {}B/s",
                info.hash,
                info.state,
                info.progress * 100.0,
                info.dlspeed
            );
            if is_paused_state(&info.state) || info.dlspeed == 0 {
                ok_paused = true;
                break;
            }
        }
        tokio::time::sleep(Duration::from_millis(300)).await;
    }
    assert!(ok_paused, "pause didn't reflect in state/speed");

    let _ = qb.resume(&hash).await;
    tokio::time::sleep(Duration::from_millis(delay_ms())).await;
    let mut ok_resumed = false;
    for _ in 0..10 {
        let resumed = qb.get_torrents_info(vec![hash.clone()]).await?;
        if let Some(info) = resumed.get(0) {
            println!(
                "resumed: {} {} {:.2}% {}B/s",
                info.hash,
                info.state,
                info.progress * 100.0,
                info.dlspeed
            );
            if !is_paused_state(&info.state) {
                ok_resumed = true;
                break;
            }
        }
        tokio::time::sleep(Duration::from_millis(300)).await;
    }
    assert!(ok_resumed, "resume didn't reflect in state");

    qb.delete(&hash, true).await?;
    tokio::time::sleep(Duration::from_millis(delay_ms())).await;

    for _ in 0..10 {
        let infos = qb.get_torrents_info(vec![hash.clone()]).await?;
        if infos.is_empty() {
            break;
        }
        tokio::time::sleep(Duration::from_millis(200)).await;
    }
    let infos = qb.get_torrents_info(vec![hash.clone()]).await?;
    assert!(infos.is_empty());

    Ok(())
}

#[tokio::test]
async fn test_repo_roundtrip() -> Result<(), AppError> {
    let base = std::env::temp_dir().join("animefun-tests");
    animefun_lib::infra::db::init_pools(base.clone()).await?;

    let h = "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
    repo::insert(h, 1, Some(1), None, None).await?;
    let list1 = repo::list().await?;
    assert!(list1.iter().any(|x| x.hash == h));

    repo::delete(h.to_string()).await?;
    let list3 = repo::list().await?;
    assert!(!list3.iter().any(|x| x.hash == h));
    Ok(())
}
