use crate::error::{AppError, CommandResult};
use crate::infra::path::app_base_dir;
use crate::services::bangumi_service::client::CLIENT;
use std::path::Path;
use std::time::{Duration, SystemTime};

const IMAGE_TTL_SECS: i64 = 90 * 24 * 3600;

fn infer_ext_from_url(url: &str) -> &'static str {
    let url_no_query = url.split('?').next().unwrap_or(url);
    if let Some(pos) = url_no_query.rfind('.') {
        let ext = url_no_query[pos + 1..].to_ascii_lowercase();
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

async fn expired(path: &Path) -> Result<bool, AppError> {
    let md = tokio::fs::metadata(path).await?;
    let modified = md.modified()?;
    let now = SystemTime::now();
    let age = now
        .duration_since(modified)
        .unwrap_or(Duration::from_secs(0))
        .as_secs() as i64;
    Ok(age > IMAGE_TTL_SECS)
}

fn normalize_for_cache(url: &str) -> String {
    let u = url.trim();
    match u.find("://") {
        Some(idx) => u[idx + 3..].to_string(),
        None => u.to_string(),
    }
}

fn sha256_hex(input: &str) -> String {
    let mut hasher = sha2::Sha256::new();
    use sha2::Digest;
    hasher.update(input.as_bytes());
    let digest = hasher.finalize();
    digest
        .iter()
        .map(|b| format!("{:02x}", b))
        .collect::<String>()
}

async fn try_existing(images_dir: &Path, hash: &str) -> Result<Option<String>, AppError> {
    for ext in ["jpg", "png", "webp"] {
        let p = images_dir.join(format!("{}.{}", hash, ext));
        if tokio::fs::metadata(&p).await.is_ok() {
            if expired(&p).await? {
                let _ = tokio::fs::remove_file(&p).await;
                continue;
            } else {
                return Ok(Some(p.to_string_lossy().to_string()));
            }
        }
    }
    Ok(None)
}

pub async fn cache_image(app: tauri::AppHandle, url: String) -> CommandResult<String> {
    let base = app_base_dir(&app);

    let images_dir = base.join("images");
    tokio::fs::create_dir_all(&images_dir).await?;

    let norm = normalize_for_cache(&url);
    let hash_norm = sha256_hex(&norm);

    if let Some(p) = try_existing(&images_dir, &hash_norm).await? {
        return Ok(p);
    }

    let mut ext = infer_ext_from_url(&url);
    let mut file_path = images_dir.join(format!("{}.{}", hash_norm, ext));

    let resp = CLIENT.get(&url).send().await?;
    resp.error_for_status_ref()?;
    let ct = resp
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    let content_ext = ext_from_content_type(ct);
    if content_ext != ext {
        ext = content_ext;
        file_path = images_dir.join(format!("{}.{}", hash_norm, ext));
    }
    let bytes = resp.bytes().await?;
    tokio::fs::write(&file_path, &bytes).await?;

    Ok(file_path.to_string_lossy().to_string())
}

pub async fn cleanup_images(app: tauri::AppHandle) -> Result<(), AppError> {
    let base = app_base_dir(&app);
    let images_dir = base.join("images");
    if tokio::fs::metadata(&images_dir).await.is_err() {
        return Ok(());
    }
    let mut rd = tokio::fs::read_dir(&images_dir).await?;
    while let Some(entry) = rd.next_entry().await? {
        let p = entry.path();
        if p.is_file() && expired(&p).await? {
            let _ = tokio::fs::remove_file(&p).await;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_infer_ext_from_url() {
        assert_eq!(infer_ext_from_url("http://x/y.jpg"), "jpg");
        assert_eq!(infer_ext_from_url("http://x/y.jpeg?x=1"), "jpg");
        assert_eq!(infer_ext_from_url("http://x/y.png"), "png");
        assert_eq!(infer_ext_from_url("http://x/y.webp"), "webp");
        assert_eq!(infer_ext_from_url("http://x/y"), "jpg");
    }
}
