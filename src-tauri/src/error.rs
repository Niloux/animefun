//! src-tauri/src/error.rs

// 定义一个统一的错误类型
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error(transparent)]
    Reqwest(#[from] reqwest::Error),
    // 在这里可以添加更多错误类型, 例如 I/O 错误或数据库错误
    // #[error("I/O error: {0}")]
    // Io(#[from] std::io::Error),
}

// 为 Tauri 命令定义一个专门的 Result 类型别名
pub type CommandResult<T, E = String> = std::result::Result<T, E>;

// 实现 Serialize 以便错误可以被发送到前端
impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}
