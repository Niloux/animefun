use once_cell::sync::OnceCell;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use sysinfo::{Signal, System};
use tauri::AppHandle;
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;
use tracing::{error, info};

pub struct SidecarManager;

static SIDECAR_RUNNING: AtomicBool = AtomicBool::new(false);
static SIDECAR_CHILD: OnceCell<Mutex<Option<CommandChild>>> = OnceCell::new();

impl SidecarManager {
    pub fn start(app: &AppHandle) {
        if SIDECAR_RUNNING.load(Ordering::Relaxed) {
            return;
        }

        let app_handle = app.clone();
        let base_dir = crate::infra::path::app_base_dir(&app_handle).join("downloads");
        if let Err(e) = std::fs::create_dir_all(&base_dir) {
            error!("create downloads dir failed: {}", e);
        }
        let download_dir_str = base_dir.to_string_lossy().to_string();

        tauri::async_runtime::spawn(async move {
            let client = Some(crate::infra::http::CLIENT_LOCAL.clone());
            if let Some(cli) = client {
                if let Ok(resp) = cli.get("http://127.0.0.1:3030/torrents").send().await {
                    if resp.status().is_success() {
                        SIDECAR_RUNNING.store(true, Ordering::Relaxed);
                        info!("rqbit server already running, reuse existing instance");
                        return;
                    }
                }
            }
            let sidecar_command = app_handle.shell().sidecar("rqbit");

            match sidecar_command {
                Ok(cmd) => {
                    let cmd = cmd.args(["server", "start", &download_dir_str]);

                    info!("starting rqbit sidecar dir={}", download_dir_str);
                    match cmd.spawn() {
                        Ok((mut rx, child)) => {
                            SIDECAR_RUNNING.store(true, Ordering::Relaxed);
                            let m = SIDECAR_CHILD.get_or_init(|| Mutex::new(None));
                            if let Ok(mut g) = m.lock() {
                                *g = Some(child);
                            }

                            while let Some(event) = rx.recv().await {
                                match event {
                                    CommandEvent::Stdout(line) => {
                                        let raw = String::from_utf8_lossy(&line);
                                        let log = strip_ansi(raw.trim());
                                        info!("rqbit: {}", log);
                                    }
                                    CommandEvent::Stderr(line) => {
                                        let raw = String::from_utf8_lossy(&line);
                                        let log = strip_ansi(raw.trim());
                                        error!("rqbit err: {}", log);
                                    }
                                    CommandEvent::Terminated(code) => {
                                        SIDECAR_RUNNING.store(false, Ordering::Relaxed);
                                        let m = SIDECAR_CHILD.get_or_init(|| Mutex::new(None));
                                        if let Ok(mut g) = m.lock() {
                                            let _ = g.take();
                                        }
                                        info!("rqbit terminated code={:?}", code);
                                    }
                                    CommandEvent::Error(err) => {
                                        error!("rqbit error: {}", err);
                                    }
                                    _ => {}
                                }
                            }

                            SIDECAR_RUNNING.store(false, Ordering::Relaxed);
                            let m = SIDECAR_CHILD.get_or_init(|| Mutex::new(None));
                            if let Ok(mut g) = m.lock() {
                                let _ = g.take();
                            }
                            info!("rqbit sidecar exited");
                        }
                        Err(e) => {
                            error!("spawn rqbit sidecar failed: {}", e);
                            error!("ensure 'rqbit' binary exists in src-tauri/binaries/");
                        }
                    }
                }
                Err(e) => {
                    error!("create sidecar command failed: {}", e);
                }
            }
        });
    }

    pub fn is_running() -> bool {
        SIDECAR_RUNNING.load(Ordering::Relaxed)
    }

    pub fn stop(app: &AppHandle) {
        let m = SIDECAR_CHILD.get_or_init(|| Mutex::new(None));
        let mut killed = false;
        if let Ok(mut g) = m.lock() {
            if let Some(child) = g.take() {
                if child.kill().is_ok() {
                    killed = true;
                }
                SIDECAR_RUNNING.store(false, Ordering::Relaxed);
                info!("rqbit sidecar killed on app exit");
            }
        }
        if !killed {
            let base_dir = crate::infra::path::app_base_dir(app).join("downloads");
            let base_dir_str = base_dir.to_string_lossy().to_string();
            let mut system = System::new_all();
            system.refresh_all();
            for (_pid, process) in system.processes() {
                if process.name() == "rqbit" {
                    let cmdline = process.cmd().join(" ");
                    if cmdline.contains(&base_dir_str) {
                        let _ = process.kill_with(Signal::Term);
                        SIDECAR_RUNNING.store(false, Ordering::Relaxed);
                        info!("rqbit external instance killed");
                        break;
                    }
                }
            }
        }
    }
}

fn strip_ansi(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut chars = s.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '\u{1b}' {
            if let Some('[') = chars.peek().cloned() {
                let _ = chars.next();
                while let Some(ch) = chars.next() {
                    if ch.is_ascii_alphabetic() {
                        break;
                    }
                }
                continue;
            }
            continue;
        }
        out.push(c);
    }
    out
}
