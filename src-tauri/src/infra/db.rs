use deadpool_sqlite::{Config as DbConfig, Pool as DbPool, Runtime as DbRuntime};
use once_cell::sync::OnceCell;
use std::path::PathBuf;
use std::sync::Mutex;

use crate::error::AppError;

static CACHE_DB_POOL: OnceCell<DbPool> = OnceCell::new();
static DATA_DB_POOL: OnceCell<DbPool> = OnceCell::new();
static CACHE_DB_PATH: OnceCell<Mutex<Option<PathBuf>>> = OnceCell::new();
static DATA_DB_PATH: OnceCell<Mutex<Option<PathBuf>>> = OnceCell::new();

/// 通用数据库初始化函数
fn init_db(
    pool_cell: &'static OnceCell<DbPool>,
    path_cell: &'static OnceCell<Mutex<Option<PathBuf>>>,
    base_dir: PathBuf,
    filename: &str,
) -> Result<(), AppError> {
    std::fs::create_dir_all(&base_dir)?;
    let file = base_dir.join(filename);

    // 检查是否已初始化，如果已初始化则验证路径是否匹配
    if let Some(path_mutex) = path_cell.get() {
        let existing_path = path_mutex.lock().unwrap();
        if let Some(existing) = existing_path.as_ref() {
            if existing != &file {
                return Err(AppError::Any(format!(
                    "database already initialized with different path: {} vs {}",
                    existing.display(),
                    file.display()
                )));
            }
            // 路径相同，幂等返回
            return Ok(());
        }
    }

    let cfg = DbConfig::new(file.to_string_lossy().to_string());
    let pool = cfg.create_pool(DbRuntime::Tokio1)?;

    // 记录路径
    let _ = path_cell.get_or_init(|| Mutex::new(Some(file.clone())));

    // 设置连接池
    pool_cell
        .set(pool)
        .map_err(|_| AppError::Any("database already initialized".to_string()))?;

    Ok(())
}

pub fn init_pools(base_dir: PathBuf) -> Result<(), AppError> {
    init_db(&CACHE_DB_POOL, &CACHE_DB_PATH, base_dir.clone(), "cache.sqlite")?;
    init_db(&DATA_DB_POOL, &DATA_DB_PATH, base_dir, "data.sqlite")?;
    Ok(())
}

pub fn cache_pool() -> Result<&'static DbPool, AppError> {
    CACHE_DB_POOL
        .get()
        .ok_or_else(|| std::io::Error::other("pool_uninit").into())
}

pub fn data_pool() -> Result<&'static DbPool, AppError> {
    DATA_DB_POOL
        .get()
        .ok_or_else(|| std::io::Error::other("pool_uninit").into())
}
