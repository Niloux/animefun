//! src-tauri/src/commands/user_profile.rs

use crate::error::CommandResult;
use crate::models::user_profile::UserProfile;
use crate::services::user_profile as profile_service;

#[tauri::command]
pub async fn get_user_profile() -> CommandResult<UserProfile> {
    let mut profile = profile_service::get_profile().await?;
    profile.has_custom_avatar = profile_service::has_avatar();
    Ok(profile)
}

#[tauri::command]
pub async fn update_user_profile(name: String, bio: String) -> CommandResult<()> {
    let mut profile = profile_service::get_profile().await?;
    profile.name = name;
    profile.bio = bio;
    profile_service::save_profile(profile).await
}

#[tauri::command]
pub async fn update_user_avatar(base64_data: String) -> CommandResult<()> {
    profile_service::save_avatar(base64_data).await?;
    let mut profile = profile_service::get_profile().await?;
    profile.has_custom_avatar = true;
    profile_service::save_profile(profile).await
}

#[tauri::command]
pub async fn reset_user_avatar() -> CommandResult<()> {
    profile_service::remove_avatar().await?;
    let mut profile = profile_service::get_profile().await?;
    profile.has_custom_avatar = false;
    profile_service::save_profile(profile).await
}
