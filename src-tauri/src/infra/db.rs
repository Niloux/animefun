use once_cell::sync::OnceCell;
use deadpool_sqlite::{Config as DbConfig, Pool as DbPool, Runtime as DbRuntime};
use std::path::PathBuf;

use crate::error::AppError;

static CACHE_DB_POOL: OnceCell<DbPool> = OnceCell::new();
static DATA_DB_POOL: OnceCell<DbPool> = OnceCell::new();

pub fn init_cache_db(base_dir: PathBuf) -> Result<(), AppError> {
    std::fs::create_dir_all(&base_dir)?;
    let file = base_dir.join("cache.sqlite");
    let cfg = DbConfig::new(file.to_string_lossy().to_string());
    let pool = cfg.create_pool(DbRuntime::Tokio1)?;
    CACHE_DB_POOL.set(pool).ok();
    Ok(())
}

pub fn init_data_db(base_dir: PathBuf) -> Result<(), AppError> {
    std::fs::create_dir_all(&base_dir)?;
    let file = base_dir.join("data.sqlite");
    let cfg = DbConfig::new(file.to_string_lossy().to_string());
    let pool = cfg.create_pool(DbRuntime::Tokio1)?;
    DATA_DB_POOL.set(pool).ok();
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
