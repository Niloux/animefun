use crate::error::{AppError, CommandResult};
use crate::models::profile::UserProfile;
use crate::services::profile;
use std::fs;

const MAX_AVATAR_SIZE: u64 = 50 * 1024 * 1024;
const MAX_USERNAME_LEN: usize = 50;
const MAX_SIGNATURE_LEN: usize = 200;

const ALLOWED_MIME_TYPES: &[&str] = &["image/png", "image/jpeg", "image/gif", "image/webp"];

#[tauri::command]
pub fn get_user_profile() -> CommandResult<UserProfile> {
    profile::get_profile()
}

#[tauri::command]
pub fn update_user_profile(username: String, signature: String) -> CommandResult<()> {
    if username.chars().count() > MAX_USERNAME_LEN {
        return Err(AppError::ProfileInvalid(format!(
            "用户名长度不能超过 {} 个字符",
            MAX_USERNAME_LEN
        )));
    }
    if signature.chars().count() > MAX_SIGNATURE_LEN {
        return Err(AppError::ProfileInvalid(format!(
            "个性签名长度不能超过 {} 个字符",
            MAX_SIGNATURE_LEN
        )));
    }

    // Atomic update via service transaction
    profile::update_profile(|p| {
        p.username = username;
        p.signature = signature;
    })
}

#[tauri::command]
pub async fn upload_avatar(app: tauri::AppHandle) -> CommandResult<UserProfile> {
    use tauri_plugin_dialog::{DialogExt, FilePath};
    use tokio::sync::oneshot;

    let (tx, rx) = oneshot::channel();

    app.dialog()
        .file()
        .add_filter("Image", &["png", "jpg", "jpeg", "gif", "webp"])
        .pick_file(move |file_path: Option<FilePath>| {
            let _ = tx.send(file_path);
        });

    let file_path = rx
        .await
        .map_err(|_| AppError::FileSelectionFailed)?
        .ok_or(AppError::FileSelectionCancelled)?;

    let path = match file_path {
        FilePath::Path(p) => p,
        FilePath::Url(url) => url
            .to_file_path()
            .map_err(|_| AppError::FileSelectionFailed)?,
    };

    // Perform heavy file reading outside the lock
    let metadata = fs::metadata(&path)?;
    if metadata.len() > MAX_AVATAR_SIZE {
        return Err(AppError::AvatarTooLarge);
    }

    let data = fs::read(&path)?;

    let extension = path
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("png");

    let mime_type = get_mime_type(&data).ok_or(AppError::UnsupportedImage)?;
    if !ALLOWED_MIME_TYPES.contains(&mime_type.as_str()) {
        return Err(AppError::UnsupportedImage);
    }

    // Pass data to service to safely update state
    profile::set_avatar(&data, extension)
}

fn get_mime_type(data: &[u8]) -> Option<String> {
    match data {
        [0x89, 0x50, 0x4E, 0x47, ..] => Some("image/png".to_string()),
        [0xFF, 0xD8, 0xFF, ..] => Some("image/jpeg".to_string()),
        [0x47, 0x49, 0x46, 0x38, ..] => Some("image/gif".to_string()),
        [0x52, 0x49, 0x46, 0x46, ..] if data.len() >= 12 => {
            if &data[8..12] == b"WEBP" {
                Some("image/webp".to_string())
            } else {
                None
            }
        }
        _ => None,
    }
}
