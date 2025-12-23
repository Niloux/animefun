use deadpool_sqlite::{Config as DbConfig, Pool as DbPool, Runtime as DbRuntime};
use once_cell::sync::OnceCell;
use std::path::PathBuf;

use crate::error::AppError;

static CACHE_DB_POOL: OnceCell<DbPool> = OnceCell::new();
static DATA_DB_POOL: OnceCell<DbPool> = OnceCell::new();

/// 通用数据库初始化函数
fn init_db(
    pool_cell: &'static OnceCell<DbPool>,
    base_dir: PathBuf,
    filename: &str,
) -> Result<(), AppError> {
    std::fs::create_dir_all(&base_dir)?;
    let file = base_dir.join(filename);
    let cfg = DbConfig::new(file.to_string_lossy().to_string());
    let pool = cfg.create_pool(DbRuntime::Tokio1)?;

    // 尝试设置连接池，如果已存在则忽略
    let _ = pool_cell.set(pool);

    Ok(())
}

pub fn init_pools(base_dir: PathBuf) -> Result<(), AppError> {
    init_db(&CACHE_DB_POOL, base_dir.clone(), "cache.sqlite")?;
    init_db(&DATA_DB_POOL, base_dir, "data.sqlite")?;
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
