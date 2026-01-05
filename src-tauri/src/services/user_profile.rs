//! src-tauri/src/services/user_profile.rs

use crate::error::AppError;
use crate::infra::path::default_app_dir;
use crate::models::user_profile::UserProfile;
use tokio::fs;

const CONFIG_FILE: &str = "user_profile.json";
const AVATAR_FILE: &str = "avatar.png";

pub async fn get_profile() -> Result<UserProfile, AppError> {
    let path = default_app_dir().join(CONFIG_FILE);
    if !path.exists() {
        return Ok(UserProfile::default());
    }
    let content = fs::read_to_string(&path).await?;
    let profile = serde_json::from_str(&content).unwrap_or_default();
    Ok(profile)
}

pub async fn save_profile(profile: UserProfile) -> Result<(), AppError> {
    let dir = default_app_dir();
    if !dir.exists() {
        fs::create_dir_all(&dir).await?;
    }
    let path = dir.join(CONFIG_FILE);
    let content = serde_json::to_string_pretty(&profile)?;
    fs::write(&path, content).await?;
    Ok(())
}

pub async fn save_avatar(base64_data: String) -> Result<(), AppError> {
    const MAX_AVATAR_BYTES: usize = 2 * 1024 * 1024; // 2MB

    let (_, data) = base64_data
        .split_once(',')
        .ok_or_else(|| AppError::Any("invalid_base64_format".into()))?;

    let bytes = base64::Engine::decode(&base64::prelude::BASE64_STANDARD, data)
        .map_err(|_| AppError::Any("invalid_base64_data".into()))?;

    if bytes.len() > MAX_AVATAR_BYTES {
        return Err(AppError::Any("avatar_too_large".into()));
    }

    let dir = default_app_dir();
    if !dir.exists() {
        fs::create_dir_all(&dir).await?;
    }
    fs::write(dir.join(AVATAR_FILE), bytes).await?;
    Ok(())
}

pub fn has_avatar() -> bool {
    default_app_dir().join(AVATAR_FILE).exists()
}

pub async fn remove_avatar() -> Result<(), AppError> {
    let path = default_app_dir().join(AVATAR_FILE);
    if path.exists() {
        fs::remove_file(path).await?;
    }
    Ok(())
}
