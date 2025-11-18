use crate::error::CommandResult;
use tauri::Manager;

fn infer_ext_from_url(url: &str) -> &'static str {
    // try to get extension from URL path
    let url_no_query = url.split('?').next().unwrap_or(url);
    if let Some(pos) = url_no_query.rfind('.') {
        let ext = &url_no_query[pos + 1..].to_lowercase();
        match ext.as_str() {
            "jpg" | "jpeg" => "jpg",
            "png" => "png",
            "webp" => "webp",
            _ => "jpg",
        }
    } else {
        "jpg"
    }
}

fn ext_from_content_type(ct: &str) -> &'static str {
    match ct {
        s if s.starts_with("image/jpeg") => "jpg",
        s if s.starts_with("image/png") => "png",
        s if s.starts_with("image/webp") => "webp",
        _ => "jpg",
    }
}

#[tauri::command]
pub async fn cache_image(app: tauri::AppHandle, url: String) -> CommandResult<String> {
    // resolve base app data directory (fallback to ~/.animefun to match existing cache module)
    let base = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| {
            let home = std::env::var("HOME").unwrap_or_else(|_| ".".into());
            std::path::PathBuf::from(home).join(".animefun")
        });

    let images_dir = base.join("images");
    tokio::fs::create_dir_all(&images_dir).await?;

    // compute a stable file name based on URL
    let mut hasher = sha2::Sha256::new();
    use sha2::Digest;
    hasher.update(url.as_bytes());
    let digest = hasher.finalize();
    let hash_hex = digest.iter().map(|b| format!("{:02x}", b)).collect::<String>();

    let mut ext = infer_ext_from_url(&url);
    let mut file_path = images_dir.join(format!("{}.{}", hash_hex, ext));

    if tokio::fs::metadata(&file_path).await.is_ok() {
        return Ok(file_path.to_string_lossy().to_string());
    }

    // fetch image
    let resp = reqwest::get(&url).await?;
    resp.error_for_status_ref()?;
    let ct = resp
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    let content_ext = ext_from_content_type(ct);
    if content_ext != ext {
        ext = content_ext;
        file_path = images_dir.join(format!("{}.{}", hash_hex, ext));
    }
    let bytes = resp.bytes().await?;
    tokio::fs::write(&file_path, &bytes).await?;

    Ok(file_path.to_string_lossy().to_string())
}