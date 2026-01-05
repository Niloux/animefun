import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import type { DownloadItem } from "@/types/gen/downloader";
import type { DownloaderConfig } from "@/types/gen/downloader_config";
import { TorrentInfo } from "@/types/gen/torrent_info";
import {
  CalendarDay,
  Anime,
  PagedEpisode,
  SubjectStatus,
  SubjectStatusCode,
} from "../types/gen/bangumi";
import type { MikanResourcesResponse } from "@/types/gen/mikan";
import type { SearchResponse } from "@/types/gen/bangumi";

// --- Downloader ---

export const getDownloaderConfig = () =>
  invoke<DownloaderConfig>("get_downloader_config");

export const setDownloaderConfig = (config: DownloaderConfig) =>
  invoke<void>("set_downloader_config", { config });

export const testDownloaderConnection = () =>
  invoke<string>("test_downloader_connection");

export const getTrackedDownloads = () =>
  invoke<DownloadItem[]>("get_tracked_downloads");

export const getLiveDownloadInfo = () =>
  invoke<TorrentInfo[]>("get_live_download_info");

export const pauseDownload = (hash: string) =>
  invoke<void>("pause_download", { hash });

export const resumeDownload = (hash: string) =>
  invoke<void>("resume_download", { hash });

export const deleteDownload = (hash: string, deleteFiles: boolean) =>
  invoke<void>("delete_download", { hash, deleteFiles });

export const openDownloadFolder = (savePath: string) =>
  invoke<void>("open_download_folder", { savePath });

export const playVideo = (hash: string) =>
  invoke<void>("play_video", { hash });

export const addTorrentAndTrack = (
  url: string,
  subjectId: number,
  episode: number | null,
  episodeRange: string | null,
  metaJson: string | null,
) =>
  invoke<void>("add_torrent_and_track", { url, subjectId, episode, episodeRange, metaJson });

// --- Bangumi ---

export const getCalendar = () => invoke<CalendarDay[]>("get_calendar");

export const getAnimeDetail = (id: number) =>
  invoke<Anime>("get_subject", { id });

export const getEpisodes = (
  subjectId: number,
  epType?: number,
  limit?: number,
  offset?: number,
) => invoke<PagedEpisode>("get_episodes", { subjectId, epType, limit, offset });

export const getSubjectStatus = (id: number) =>
  invoke<SubjectStatus>("get_subject_status", { id });

export const searchSubject = (params: {
  keywords: string;
  subjectType?: number[];
  sort?: string;
  tag?: string[];
  airDate?: string[];
  rating?: string[];
  ratingCount?: string[];
  rank?: string[];
  nsfw?: boolean;
  limit?: number;
  offset?: number;
}) => invoke<SearchResponse>("search_subject", params);

// --- Mikan ---

export const getMikanResources = (subjectId: number) =>
  invoke<MikanResourcesResponse>("get_mikan_resources", { subjectId });

// --- Subscriptions ---

export const getSubscriptions = async () => {
  const data =
    await invoke<
      { id: number; anime: Anime; addedAt: number; notify?: boolean }[]
    >("sub_list");
  return Array.isArray(data) ? data : [];
};

export const getSubscriptionIds = async () => {
  const data = await invoke<number[]>("sub_list_ids");
  return Array.isArray(data) ? data : [];
};

export const hasSubscription = async (id: number) => {
  const res = await invoke<boolean>("sub_has", { id });
  return !!res;
};

export const toggleSubscription = async (id: number) => {
  const res = await invoke<boolean>("sub_toggle", { id });
  return !!res;
};

export const setSubscriptionNotify = (id: number, notify: boolean) =>
  invoke<void>("sub_set_notify", { id, notify });

export const clearSubscriptions = () => invoke<void>("sub_clear");

export const sendTestNotification = () =>
  invoke<void>("send_test_notification");

export const querySubscriptions = (params: {
  keywords: string | null;
  sort: string | null;
  genres: string[] | null;
  min_rating: number | null;
  max_rating: number | null;
  status_code: SubjectStatusCode | null;
  limit: number | null;
  offset: number | null;
}) => invoke<SearchResponse>("sub_query", { params });

// --- App ---

export const getAppVersion = () => getVersion();

// --- Updater ---

export interface UpdateInfo {
  available: boolean;
  currentVersion: string;
  latestVersion?: string;
  body?: string;
  date?: string;
}

export const checkUpdate = async (): Promise<UpdateInfo | null> => {
  try {
    const update = await check({ headers: { "Accept-Encoding": "gzip, deflate" } });
    if (!update?.available) {
      return { available: false, currentVersion: await getVersion() };
    }
    return {
      available: true,
      currentVersion: await getVersion(),
      latestVersion: update.version,
      body: update.body,
      date: update.date,
    };
  } catch (error) {
    console.error("Failed to check for updates:", error);
    return null;
  }
};

export const downloadAndInstall = async (
  onProgress: (progress: { current: number; total: number; percent: number }) => void,
): Promise<void> => {
  const update = await check();
  if (!update) throw new Error("No update available");

  let downloaded = 0;
  let contentLength = 0;

  await update.downloadAndInstall((event) => {
    switch (event.event) {
      case "Started":
        contentLength = event.data.contentLength ?? 0;
        break;
      case "Progress":
        downloaded += event.data.chunkLength;
        onProgress({
          current: downloaded,
          total: contentLength,
          percent: contentLength > 0 ? Math.round((downloaded / contentLength) * 100) : 0,
        });
        break;
      case "Finished":
        onProgress({
          current: contentLength,
          total: contentLength,
          percent: 100,
        });
        break;
    }
  });
};

export const restartApp = () => relaunch();
