use super::{client::RqbitClient, repo};
use crate::error::AppError;
use crate::models::download::{DownloadTask, DownloadTaskMetadata};
use tauri::{AppHandle, Emitter};
use tokio::time::{sleep, Duration};

pub struct DownloaderService {
    client: RqbitClient,
}

impl DownloaderService {
    pub fn new() -> Self {
        Self {
            client: RqbitClient::new(),
        }
    }

    pub async fn add_task(
        &self,
        anime_id: i64,
        episode_id: i64,
        magnet: String,
        save_path: String,
        metadata: DownloadTaskMetadata,
    ) -> Result<i64, AppError> {
        // 1. 调用 rqbit 接口添加任务
        let rqbit_res = self.client.add_magnet(&magnet, Some(&save_path)).await?;

        // 2. 保存到数据库
        let task = DownloadTask {
            id: 0,
            anime_id,
            episode_id,
            info_hash: rqbit_res.info_hash.clone(),
            magnet_url: magnet,
            save_path,
            status: "pending".to_string(),
            metadata: serde_json::to_string(&metadata)?,
            created_at: crate::infra::time::now_secs(),
        };

        let id = repo::add(task).await?;
        Ok(id)
    }

    pub async fn list_tasks(&self) -> Result<Vec<serde_json::Value>, AppError> {
        let db_tasks = repo::list().await?;

        let mut result = Vec::new();
        for task in db_tasks {
            let metadata: DownloadTaskMetadata = serde_json::from_str(&task.metadata)
                .unwrap_or_else(|_| DownloadTaskMetadata {
                    anime_title: "Unknown".into(),
                    episode_title: "Unknown".into(),
                    image_url: None,
                });
            result.push(serde_json::json!({
                "id": task.id,
                "anime_id": task.anime_id,
                "episode_id": task.episode_id,
                "info_hash": task.info_hash,
                "status": task.status,
                "metadata": metadata,
            }));
        }
        Ok(result)
    }

    pub async fn pause_task(&self, id: i64) -> Result<(), AppError> {
        if let Some(task) = repo::get(id).await? {
            self.client.pause(&task.info_hash).await?;
            repo::update_status(task.info_hash, "paused".to_string()).await?;
        }
        Ok(())
    }

    pub async fn resume_task(&self, id: i64) -> Result<(), AppError> {
        if let Some(task) = repo::get(id).await? {
            self.client.resume(&task.info_hash).await?;
            repo::update_status(task.info_hash, "downloading".to_string()).await?;
        }
        Ok(())
    }

    pub async fn delete_task(&self, id: i64, delete_file: bool) -> Result<(), AppError> {
        if let Some(task) = repo::get(id).await? {
            self.client.delete(&task.info_hash, delete_file).await?;
            repo::delete(id).await?;
        }
        Ok(())
    }

    pub fn start_sync_loop(&self, app: AppHandle) {
        let client = self.client.clone();
        tauri::async_runtime::spawn(async move {
            loop {
                if let Err(_e) = Self::sync_once(&client, &app).await {
                    // 侧车未运行时静默失败，避免日志泛滥
                }
                sleep(Duration::from_secs(1)).await;
            }
        });
    }

    pub async fn health(&self) -> Result<bool, AppError> {
        match self.client.list().await {
            Ok(_) => Ok(true),
            Err(_) => Ok(false),
        }
    }

    async fn sync_once(client: &RqbitClient, app: &AppHandle) -> Result<(), AppError> {
        let rqbit_tasks = match client.list().await {
            Ok(t) => t,
            Err(_) => return Ok(()),
        };

        let db_tasks = repo::list().await?;
        let mut updates = Vec::new();

        for db_task in db_tasks {
            if let Some(r_task) = rqbit_tasks
                .iter()
                .find(|t| t.info_hash == db_task.info_hash)
            {
                let new_status = r_task.state.as_deref().unwrap_or("unknown");
                if db_task.status != new_status {
                    repo::update_status(db_task.info_hash.clone(), new_status.to_string())
                        .await
                        .ok();
                }

                let metadata: DownloadTaskMetadata = serde_json::from_str(&db_task.metadata)
                    .unwrap_or_else(|_| DownloadTaskMetadata {
                        anime_title: "Unknown".into(),
                        episode_title: "Unknown".into(),
                        image_url: None,
                    });

                updates.push(serde_json::json!({
                    "id": db_task.id,
                    "anime_id": db_task.anime_id,
                    "episode_id": db_task.episode_id,
                    "info_hash": db_task.info_hash,
                    "metadata": metadata,
                    "status": new_status,
                    "progress": r_task.progress,
                    "download_speed": r_task.download_speed,
                    "total_bytes": r_task.total_bytes,
                    "finished_bytes": r_task.finished_bytes,
                }));
            }
        }

        if !updates.is_empty() {
            app.emit("download-progress", updates)?;
        }

        Ok(())
    }
}
