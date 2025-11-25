use std::path::PathBuf;

use crate::error::AppError;

pub fn init(base_dir: PathBuf) -> Result<(), AppError> {
    crate::infra::db::init_data_db(base_dir)?;
    Ok(())
}
