use once_cell::sync::OnceCell;
use tracing_subscriber::EnvFilter;

static INIT: OnceCell<()> = OnceCell::new();

pub fn init() {
    if INIT.get().is_some() { return; }
    let _ = tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .compact()
        .try_init();
    let _ = INIT.set(());
}