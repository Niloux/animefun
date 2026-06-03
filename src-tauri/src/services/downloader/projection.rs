use super::{
    client, extract_resolution, parse_metadata, repo, DownloadExternalState, DownloadItem,
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DownloadDisplayMetadata {
    pub title: String,
    pub cover: String,
    pub meta_json: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SubjectDisplayMetadata {
    pub name: String,
    pub name_cn: String,
    pub cover_url: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FetchedDisplayMetadata {
    pub title: String,
    pub cover: String,
    pub meta_json: String,
}

pub fn has_valid_saved_metadata(meta_json: Option<&str>) -> bool {
    meta_json.and_then(parse_metadata).is_some()
}

pub fn select_display_metadata(
    saved_meta_json: Option<&str>,
    index_metadata: Option<&SubjectDisplayMetadata>,
    fetched_metadata: Option<&FetchedDisplayMetadata>,
) -> DownloadDisplayMetadata {
    if let Some((title, cover)) = saved_meta_json.and_then(parse_metadata) {
        return DownloadDisplayMetadata {
            title,
            cover,
            meta_json: saved_meta_json.map(str::to_string),
        };
    }

    if let Some(meta) = index_metadata {
        let title = if meta.name_cn.is_empty() {
            meta.name.clone()
        } else {
            meta.name_cn.clone()
        };
        if !title.is_empty() && !meta.cover_url.is_empty() {
            let meta_json = super::build_metadata(title.clone(), meta.cover_url.clone());
            return DownloadDisplayMetadata {
                title,
                cover: meta.cover_url.clone(),
                meta_json: Some(meta_json),
            };
        }
    }

    if let Some(meta) = fetched_metadata {
        return DownloadDisplayMetadata {
            title: meta.title.clone(),
            cover: meta.cover.clone(),
            meta_json: Some(meta.meta_json.clone()),
        };
    }

    DownloadDisplayMetadata {
        title: "Unknown".to_string(),
        cover: String::new(),
        meta_json: None,
    }
}

pub fn build_status_projection(
    tracked: Vec<repo::TrackedDownload>,
    metadata_list: Vec<DownloadDisplayMetadata>,
    live_infos: Option<Vec<client::TorrentInfo>>,
) -> Vec<DownloadItem> {
    tracked
        .into_iter()
        .zip(metadata_list)
        .map(|(tracked_download, metadata)| {
            let live = live_infos
                .as_ref()
                .and_then(|infos| infos.iter().find(|live| live.hash == tracked_download.hash));

            if let Some(live) = live {
                let resolution = extract_resolution(Some(&live.name), &metadata.title);
                DownloadItem {
                    hash: tracked_download.hash,
                    subject_id: tracked_download.subject_id,
                    episode: tracked_download.episode,
                    episode_range: tracked_download.episode_range,
                    resolution,
                    external_state: DownloadExternalState::Live {
                        status: live.state.clone(),
                    },
                    progress: live.progress * 100.0,
                    dlspeed: live.dlspeed,
                    eta: live.eta,
                    title: metadata.title,
                    cover: metadata.cover,
                    meta_json: metadata.meta_json.or(tracked_download.meta_json),
                    save_path: Some(live.save_path.clone()),
                }
            } else {
                let external_state = if live_infos.is_some() {
                    DownloadExternalState::Missing
                } else {
                    DownloadExternalState::Stale
                };
                let resolution = extract_resolution(None, &metadata.title);
                DownloadItem {
                    hash: tracked_download.hash,
                    subject_id: tracked_download.subject_id,
                    episode: tracked_download.episode,
                    episode_range: tracked_download.episode_range,
                    resolution,
                    external_state,
                    progress: 0.0,
                    dlspeed: 0,
                    eta: 0,
                    title: metadata.title,
                    cover: metadata.cover,
                    meta_json: metadata.meta_json.or(tracked_download.meta_json),
                    save_path: None,
                }
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tracked(hash: &str, subject_id: u32) -> repo::TrackedDownload {
        repo::TrackedDownload {
            id: 1,
            hash: hash.to_string(),
            subject_id,
            episode: Some(1),
            episode_range: None,
            meta_json: None,
            created_at: 1,
            updated_at: 1,
        }
    }

    fn live(hash: &str, name: &str) -> client::TorrentInfo {
        client::TorrentInfo {
            hash: hash.to_string(),
            name: name.to_string(),
            state: "downloading".to_string(),
            progress: 0.5,
            dlspeed: 1024,
            eta: 60,
            save_path: "/tmp/anime".to_string(),
        }
    }

    fn metadata(title: &str) -> DownloadDisplayMetadata {
        DownloadDisplayMetadata {
            title: title.to_string(),
            cover: "cover".to_string(),
            meta_json: None,
        }
    }

    #[test]
    fn projects_live_state_when_external_download_matches() {
        let items = build_status_projection(
            vec![tracked("hash-a", 1)],
            vec![metadata("Anime")],
            Some(vec![live("hash-a", "Anime - 01 1080p")]),
        );

        match &items[0].external_state {
            DownloadExternalState::Live { status } => assert_eq!(status, "downloading"),
            _ => panic!("expected live state"),
        }
        assert_eq!(items[0].progress, 50.0);
        assert_eq!(items[0].save_path.as_deref(), Some("/tmp/anime"));
        assert_eq!(items[0].resolution, Some(1080));
    }

    #[test]
    fn projects_missing_state_when_external_downloader_has_no_hash() {
        let items = build_status_projection(
            vec![tracked("hash-a", 1)],
            vec![metadata("Anime")],
            Some(vec![live("hash-b", "Anime - 01 1080p")]),
        );

        assert!(matches!(
            items[0].external_state,
            DownloadExternalState::Missing
        ));
    }

    #[test]
    fn projects_stale_state_when_external_state_is_unavailable() {
        let items =
            build_status_projection(vec![tracked("hash-a", 1)], vec![metadata("Anime")], None);

        assert!(matches!(
            items[0].external_state,
            DownloadExternalState::Stale
        ));
    }

    #[test]
    fn selects_saved_metadata_first() {
        let saved = super::super::build_metadata("Saved".to_string(), "saved-cover".to_string());
        let selected = select_display_metadata(
            Some(&saved),
            Some(&SubjectDisplayMetadata {
                name: "Index".to_string(),
                name_cn: "索引".to_string(),
                cover_url: "index-cover".to_string(),
            }),
            Some(&FetchedDisplayMetadata {
                title: "Fetched".to_string(),
                cover: "fetched-cover".to_string(),
                meta_json: "fetched-json".to_string(),
            }),
        );

        assert_eq!(selected.title, "Saved");
        assert_eq!(selected.cover, "saved-cover");
        assert_eq!(selected.meta_json.as_deref(), Some(saved.as_str()));
    }

    #[test]
    fn falls_back_to_index_metadata_before_fetched_metadata() {
        let selected = select_display_metadata(
            Some("{\"resource_title\":\"\",\"cover_url\":\"\"}"),
            Some(&SubjectDisplayMetadata {
                name: "Index".to_string(),
                name_cn: "索引".to_string(),
                cover_url: "index-cover".to_string(),
            }),
            Some(&FetchedDisplayMetadata {
                title: "Fetched".to_string(),
                cover: "fetched-cover".to_string(),
                meta_json: "fetched-json".to_string(),
            }),
        );

        assert_eq!(selected.title, "索引");
        assert_eq!(selected.cover, "index-cover");
        assert!(selected.meta_json.is_some());
    }

    #[test]
    fn falls_back_to_fetched_metadata_when_index_is_incomplete() {
        let selected = select_display_metadata(
            None,
            Some(&SubjectDisplayMetadata {
                name: "Index".to_string(),
                name_cn: String::new(),
                cover_url: String::new(),
            }),
            Some(&FetchedDisplayMetadata {
                title: "Fetched".to_string(),
                cover: "fetched-cover".to_string(),
                meta_json: "fetched-json".to_string(),
            }),
        );

        assert_eq!(selected.title, "Fetched");
        assert_eq!(selected.cover, "fetched-cover");
        assert_eq!(selected.meta_json.as_deref(), Some("fetched-json"));
    }
}
