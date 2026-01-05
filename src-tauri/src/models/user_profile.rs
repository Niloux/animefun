//! src-tauri/src/models/user_profile.rs

use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/types/gen/user_profile.ts")]
pub struct UserProfile {
    pub name: String,
    pub bio: String,
    pub has_custom_avatar: bool,
}

impl Default for UserProfile {
    fn default() -> Self {
        Self {
            name: "喜多郁代".to_string(),
            bio: "きた,いくよ".to_string(),
            has_custom_avatar: false,
        }
    }
}
