use crate::models::profile::UserProfile;
use crate::services::profile;
use std::fs;
use tracing::error;

const MAX_AVATAR_SIZE: u64 = 50 * 1024 * 1024;
const MAX_USERNAME_LEN: usize = 50;
const MAX_SIGNATURE_LEN: usize = 200;

const ALLOWED_MIME_TYPES: &[&str] = &["image/png", "image/jpeg", "image/gif", "image/webp"];

#[tauri::command]
pub fn get_user_profile() -> UserProfile {
    // 如果加载失败（如权限错误），回退到默认值以保持 UI 稳定性
    profile::get_profile().unwrap_or_else(|e| {
        error!("加载 profile 失败: {}", e);
        UserProfile::default()
    })
}

#[tauri::command]
pub fn update_user_profile(username: String, signature: String) -> Result<(), String> {
    if username.chars().count() > MAX_USERNAME_LEN {
        return Err(format!("用户名长度不能超过 {} 个字符", MAX_USERNAME_LEN));
    }
    if signature.chars().count() > MAX_SIGNATURE_LEN {
        return Err(format!("个性签名长度不能超过 {} 个字符", MAX_SIGNATURE_LEN));
    }

    // Atomic update via service transaction
    profile::update_profile(|p| {
        p.username = username;
        p.signature = signature;
    })
}

#[tauri::command]
pub async fn upload_avatar(app: tauri::AppHandle) -> Result<UserProfile, String> {
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
        .map_err(|_| "文件选择失败".to_string())?
        .ok_or("未选择文件".to_string())?;

    let path = match file_path {
        FilePath::Path(p) => p,
        FilePath::Url(url) => url
            .to_file_path()
            .map_err(|_| "无法从 URL 提取文件路径".to_string())?,
    };

    // Perform heavy file reading outside the lock
    let metadata = fs::metadata(&path).map_err(|e| format!("获取文件信息失败: {}", e))?;
    if metadata.len() > MAX_AVATAR_SIZE {
        return Err(format!(
            "图片大小不能超过 {}MB",
            MAX_AVATAR_SIZE / 1024 / 1024
        ));
    }

    let data = fs::read(&path).map_err(|e| format!("读取文件失败: {}", e))?;

    let extension = path
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("png");

    let mime_type = get_mime_type(&data).ok_or("无法确定图片类型")?;
    if !ALLOWED_MIME_TYPES.contains(&mime_type.as_str()) {
        return Err("不支持的图片格式".to_string());
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
