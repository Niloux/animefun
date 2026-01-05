//! src-tauri/src/commands/user_profile.rs

use crate::error::CommandResult;
use crate::infra::path::default_app_dir;
use crate::models::user_profile::UserProfile;
use crate::services::user_profile as profile_service;
use tokio::fs;
use base64::Engine;

#[tauri::command]
pub async fn get_user_profile() -> CommandResult<UserProfile> {
    let mut profile = profile_service::get_profile().await?;
    profile.has_custom_avatar = profile_service::has_avatar();
    Ok(profile)
}

#[tauri::command]
pub async fn get_avatar_data_url() -> CommandResult<String> {
    let path = default_app_dir().join("avatar.png");
    if !path.exists() {
        return Ok("".to_string());
    }

    let bytes = fs::read(&path).await?;

    // 简单检测文件类型
    let mime = if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
        "image/jpeg"
    } else if bytes.starts_with(b"PNG") {
        "image/png"
    } else if bytes.len() > 12 && bytes.get(8..12) == Some(b"WEBP") {
        "image/webp"
    } else {
        "image/png"
    };

    let base64_str = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:{};base64,{}", mime, base64_str))
}

#[tauri::command]
pub async fn update_user_profile(name: String, bio: String) -> CommandResult<UserProfile> {
    let mut profile = profile_service::get_profile().await?;
    profile.name = name;
    profile.bio = bio;
    profile_service::save_profile(profile.clone()).await?;
    Ok(profile)
}

#[tauri::command]
pub async fn update_user_avatar(base64_data: String) -> CommandResult<UserProfile> {
    profile_service::save_avatar(base64_data).await?;
    let mut profile = profile_service::get_profile().await?;
    profile.has_custom_avatar = true;
    profile_service::save_profile(profile.clone()).await?;
    Ok(profile)
}

#[tauri::command]
pub async fn reset_user_avatar() -> CommandResult<UserProfile> {
    profile_service::remove_avatar().await?;
    let mut profile = profile_service::get_profile().await?;
    profile.has_custom_avatar = false;
    profile_service::save_profile(profile.clone()).await?;
    Ok(profile)
}
