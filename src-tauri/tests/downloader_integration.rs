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

    let mut qb = QbitClient::new(&conf);
    qb.login(&conf).await?;

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

    let _ = qb.pause(&hash).await;
    let _ = qb.resume(&hash).await;

    qb.delete(&hash, true).await?;

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
    animefun_lib::infra::db::init_data_db(base)?;

    let h = "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
    repo::insert(h, 1, 1, "downloading", None).await?;
    let list1 = repo::list().await?;
    assert!(list1.iter().any(|x| x.hash == h));
    repo::update_status(h.to_string(), "paused".to_string(), None).await?;
    let list2 = repo::list().await?;
    assert!(list2.iter().any(|x| x.hash == h && x.status == "paused"));
    repo::delete(h.to_string()).await?;
    let list3 = repo::list().await?;
    assert!(!list3.iter().any(|x| x.hash == h));
    Ok(())
}
