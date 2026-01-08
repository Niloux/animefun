use serde::{Deserialize, Serialize};
use std::path::Path;
use ts_rs::TS;

#[derive(Serialize, Deserialize, Clone, Debug, TS)]
#[ts(export, export_to = "../../src/types/gen/profile.rs.ts")]
pub struct UserProfile {
    pub username: String,
    pub signature: String,
    pub avatar_path: String,
}

impl UserProfile {
    /// Validate avatar_path is safe and within expected directory
    pub fn validate(&self) -> Result<(), String> {
        if self.avatar_path.is_empty() {
            return Ok(());
        }

        let path = Path::new(&self.avatar_path);

        // Check path is absolute
        if !path.is_absolute() {
            return Err("Avatar path must be absolute".to_string());
        }

        // Check file extension is valid image format
        if let Some(ext) = path.extension() {
            let ext = ext.to_string_lossy().to_lowercase();
            if !matches!(ext.as_str(), "png" | "jpg" | "jpeg" | "gif" | "webp") {
                return Err(format!("Invalid image extension: {}", ext));
            }
        } else {
            return Err("Avatar must have a file extension".to_string());
        }

        // Check filename doesn't contain suspicious patterns
        let filename = path
            .file_name()
            .and_then(|n| n.to_str())
            .ok_or("Invalid filename")?;

        if filename.contains("..") || filename.starts_with('.') {
            return Err("Invalid filename".to_string());
        }

        Ok(())
    }
}

impl Default for UserProfile {
    fn default() -> Self {
        Self {
            username: DEFAULT_USERNAME.into(),
            signature: DEFAULT_SIGNATURE.into(),
            avatar_path: "".into(),
        }
    }
}

pub const DEFAULT_USERNAME: &str = "喜多郁代";
pub const DEFAULT_SIGNATURE: &str = "きた,いくよ";
