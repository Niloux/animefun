use tracing_subscriber::{filter::LevelFilter, EnvFilter};

pub fn init() {
    let filter = EnvFilter::from_default_env().add_directive(LevelFilter::INFO.into());

    // 初始化日志系统，如果失败则输出错误信息
    if let Err(e) = tracing_subscriber::fmt()
        .with_env_filter(filter)
        .compact()
        .try_init()
    {
        eprintln!("Failed to initialize logging system: {}", e);
    }
}
