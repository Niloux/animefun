//! src-tauri/src/error.rs

// 定义一个统一的错误类型
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error(transparent)]
    Reqwest(#[from] reqwest::Error),
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error(transparent)]
    Sqlite(#[from] rusqlite::Error),
    #[error("Cache miss for key '{0}' after receiving 304 Not Modified")]
    CacheMissAfter304(String),
    #[error(transparent)]
    SerdeJson(#[from] serde_json::Error),
}

// 为 Tauri 命令定义一个专门的 Result 类型别名
// 现在它返回一个结构化的错误，而不是一个无用的字符串
pub type CommandResult<T> = std::result::Result<T, AppError>;

// 实现 Serialize 以便错误可以被发送到前端
impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        // 目前为简化仍以字符串序列化，但它源自结构化错误。
        // 未来可改为带错误码与消息的 JSON 对象。
        serializer.serialize_str(self.to_string().as_ref())
    }
}
