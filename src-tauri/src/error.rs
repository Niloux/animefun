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
    #[error(transparent)]
    DeadpoolPool(#[from] deadpool_sqlite::PoolError),
    #[error(transparent)]
    DeadpoolInteract(#[from] deadpool_sqlite::InteractError),
    #[error(transparent)]
    DeadpoolCreatePool(#[from] deadpool_sqlite::CreatePoolError),
    #[error(transparent)]
    SerdeJson(#[from] serde_json::Error),
    #[error(transparent)]
    Tauri(#[from] tauri::Error),
    #[error(transparent)]
    SerdeBencode(#[from] serde_bencode::Error),
    #[error("{0}")]
    Any(String),
}

// 为 Tauri 命令定义一个专门的 Result 类型别名
// 现在它返回一个结构化的错误，而不是一个无用的字符串
pub type CommandResult<T> = std::result::Result<T, AppError>;

impl AppError {
    pub fn code(&self) -> &'static str {
        match self {
            AppError::Reqwest(_) => "reqwest",
            AppError::Io(_) => "io",
            AppError::Sqlite(_) => "sqlite",
            AppError::DeadpoolPool(_) => "deadpool_pool",
            AppError::DeadpoolInteract(_) => "deadpool_interact",
            AppError::DeadpoolCreatePool(_) => "deadpool_create_pool",
            AppError::SerdeJson(_) => "serde_json",
            AppError::Tauri(_) => "tauri",
            AppError::SerdeBencode(_) => "serde_bencode",
            AppError::Any(_) => "any",
        }
    }
}

impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeStruct;
        let mut st = serializer.serialize_struct("AppError", 2)?;
        st.serialize_field("code", self.code())?;
        st.serialize_field("message", &self.to_string())?;
        st.end()
    }
}
