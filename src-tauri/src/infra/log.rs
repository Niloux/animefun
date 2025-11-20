use once_cell::sync::OnceCell;
use tracing_subscriber::{filter::LevelFilter, EnvFilter};

static INIT: OnceCell<()> = OnceCell::new();

pub fn init() {
    if INIT.get().is_some() {
        return;
    }
    let filter = EnvFilter::from_default_env().add_directive(LevelFilter::INFO.into());
    let _ = tracing_subscriber::fmt()
        .with_env_filter(filter)
        .compact()
        .try_init();
    let _ = INIT.set(());
}
