use crate::infra::path::default_app_dir;
use crate::models::profile::UserProfile;
use std::fs;
use std::path::PathBuf;
use std::sync::RwLock;
use tracing::warn;

const CONFIG_FILE: &str = "profile.json";
const AVATAR_FILE: &str = "avatar";

// 全局锁用于 Profile 操作
// - 读操作 (get_profile) 使用 RwLock 读锁，支持并发读取
// - 写操作 (update_profile, set_avatar) 使用写锁，保证原子性
// 对于单用户桌面应用，这是最简单且健壮的方案
static PROFILE_LOCK: RwLock<()> = RwLock::new(());

pub fn get_profile_path() -> PathBuf {
    default_app_dir().join(CONFIG_FILE)
}

pub fn get_avatar_dir() -> PathBuf {
    default_app_dir().join("avatars")
}

/// Thread-safe: loads the profile (concurrent reads allowed)
pub fn get_profile() -> Result<UserProfile, String> {
    let _guard = PROFILE_LOCK.read().map_err(|e| e.to_string())?;
    load_profile_internal()
}

/// Thread-safe: Atomic Read-Modify-Write transaction
pub fn update_profile<F>(f: F) -> Result<(), String>
where
    F: FnOnce(&mut UserProfile),
{
    let _guard = PROFILE_LOCK.write().map_err(|e| e.to_string())?;

    let mut profile = load_profile_internal()?;
    f(&mut profile);
    save_profile_internal(&profile)
}

/// Thread-safe: Save avatar and update profile atomically
pub fn set_avatar(data: &[u8], extension: &str) -> Result<UserProfile, String> {
    let _guard = PROFILE_LOCK.write().map_err(|e| e.to_string())?;

    // 1. Prepare directories and paths
    let avatar_dir = get_avatar_dir();
    fs::create_dir_all(&avatar_dir).map_err(|e| format!("创建头像目录失败: {}", e))?;

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| format!("获取时间失败: {}", e))?
        .as_secs();
    let filename = format!("{}_{}.{}", AVATAR_FILE, timestamp, extension);
    let new_avatar_path = avatar_dir.join(&filename);
    let temp_path = new_avatar_path.with_extension("tmp");

    // 2. Write image to temp file
    fs::write(&temp_path, data).map_err(|e| format!("写入头像临时文件失败: {}", e))?;

    // 3. Load current profile (inside lock)
    let mut profile = load_profile_internal()?;
    let old_avatar = profile.avatar_path.clone();

    // 4. Commit image file (Rename temp -> real)
    std::fs::rename(&temp_path, &new_avatar_path).map_err(|e| {
        let _ = fs::remove_file(&temp_path);
        format!("原子替换头像文件失败: {}", e)
    })?;

    // 5. Update profile data
    profile.avatar_path = new_avatar_path.to_string_lossy().to_string();

    // 6. Save profile to disk
    // If this fails, we have an orphaned image file, which is acceptable (better than broken profile).
    if let Err(e) = save_profile_internal(&profile) {
        return Err(format!("上传头像后保存 profile 失败: {}", e));
    }

    // 7. Cleanup old avatar (Best effort)
    // Note: No exists() check to avoid TOCTOU race. Just try to delete and ignore errors.
    if !old_avatar.is_empty() {
        let old_path = PathBuf::from(&old_avatar);
        if old_path.starts_with(&avatar_dir) && old_path != new_avatar_path {
            let _ = fs::remove_file(&old_path); // File may not exist, that's ok
        }
    }

    Ok(profile)
}

// --- 内部辅助函数（必须在锁内调用）---

fn load_profile_internal() -> Result<UserProfile, String> {
    let path = get_profile_path();
    if !path.exists() {
        return Ok(UserProfile::default());
    }

    let content = fs::read_to_string(&path).map_err(|e| format!("读取 profile 失败: {}", e))?;

    let mut profile: UserProfile =
        serde_json::from_str(&content).map_err(|e| format!("解析 profile 失败: {}", e))?;

    if let Err(e) = profile.validate() {
        return Err(format!("无效的 profile 数据: {}", e));
    }

    // 验证头像文件是否存在，若不存在则清空路径（回退到默认头像）
    // 这处理了崩溃导致的文件损坏场景
    if !profile.avatar_path.is_empty() {
        let avatar_path = PathBuf::from(&profile.avatar_path);
        if !avatar_path.exists() {
            warn!("头像文件不存在，已清空路径: {}", profile.avatar_path);
            profile.avatar_path.clear();
        }
    }

    Ok(profile)
}

fn save_profile_internal(profile: &UserProfile) -> Result<(), String> {
    let path = get_profile_path();
    let temp_path = path.with_extension("tmp");

    let content =
        serde_json::to_string_pretty(profile).map_err(|e| format!("序列化失败: {}", e))?;

    fs::write(&temp_path, content).map_err(|e| format!("写入临时文件失败: {}", e))?;

    if let Err(e) = std::fs::rename(&temp_path, path) {
        let _ = fs::remove_file(&temp_path);
        return Err(format!("原子替换失败: {}", e));
    }

    Ok(())
}
