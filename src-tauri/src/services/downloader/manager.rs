use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Manager};
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

pub struct SidecarManager;

static SIDECAR_RUNNING: AtomicBool = AtomicBool::new(false);

impl SidecarManager {
    pub fn start(app: &AppHandle) {
        if SIDECAR_RUNNING.load(Ordering::Relaxed) {
            return;
        }

        let app_handle = app.clone();
        // Resolve download directory
        let download_dir = app
            .path()
            .download_dir()
            .ok()
            .unwrap_or_else(|| std::path::PathBuf::from("."));
        let download_dir_str = download_dir.to_string_lossy().to_string();

        tauri::async_runtime::spawn(async move {
            let sidecar_command = app_handle.shell().sidecar("rqbit");

            match sidecar_command {
                Ok(cmd) => {
                    // rqbit server start <DOWNLOAD_DIR>
                    let cmd = cmd.args(["server", "start", &download_dir_str]);

                    println!("Starting rqbit sidecar with dir: {}", download_dir_str);
                    match cmd.spawn() {
                        Ok((mut rx, _child)) => {
                            SIDECAR_RUNNING.store(true, Ordering::Relaxed);

                            while let Some(event) = rx.recv().await {
                                match event {
                                    CommandEvent::Stdout(line) => {
                                        let log = String::from_utf8_lossy(&line);
                                        println!("RQBIT: {}", log.trim());
                                    }
                                    CommandEvent::Stderr(line) => {
                                        let log = String::from_utf8_lossy(&line);
                                        eprintln!("RQBIT ERR: {}", log.trim());
                                    }
                                    _ => {}
                                }
                            }

                            SIDECAR_RUNNING.store(false, Ordering::Relaxed);
                            println!("rqbit sidecar exited");
                        }
                        Err(e) => {
                            eprintln!("Failed to spawn rqbit sidecar: {}", e);
                            eprintln!(
                                "Make sure the 'rqbit' binary is placed in src-tauri/binaries/"
                            );
                        }
                    }
                }
                Err(e) => {
                    eprintln!("Failed to create sidecar command: {}", e);
                }
            }
        });
    }
}
