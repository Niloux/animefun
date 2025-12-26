import { invoke } from "@tauri-apps/api/core";
import { DownloadItem } from "@/types/gen/downloader";
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

/**
 * API Wrapper to ensure consistent error handling
 * Throws an Error with the message from the backend or a default message
 */
async function call<T>(
  command: string,
  args?: Record<string, unknown>,
  defaultErrorMsg?: string,
): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    // Ideally, we just rethrow the error.
    // The previous implementation logged it, which is bad practice for a library function.
    // We wrap it in an Error object if it's not already one, or just propagate string errors.
    const msg =
      typeof error === "string"
        ? error
        : (error as Error).message || "Unknown error";
    throw new Error(defaultErrorMsg ? `${defaultErrorMsg}: ${msg}` : msg);
  }
}

// --- Downloader ---

export const getDownloaderConfig = async () =>
  call<DownloaderConfig>(
    "get_downloader_config",
    undefined,
    "Failed to get downloader config",
  );

export const setDownloaderConfig = async (config: DownloaderConfig) =>
  call<void>(
    "set_downloader_config",
    { config },
    "Failed to save downloader config",
  );

export const getTrackedDownloads = async () =>
  call<DownloadItem[]>(
    "get_tracked_downloads",
    undefined,
    "Failed to get downloads",
  );

export const getLiveDownloadInfo = async () =>
  call<TorrentInfo[]>(
    "get_live_download_info",
    undefined,
    "Failed to get download info",
  );

export const pauseDownload = async (hash: string) =>
  call<void>("pause_download", { hash }, "Failed to pause download");

export const resumeDownload = async (hash: string) =>
  call<void>("resume_download", { hash }, "Failed to resume download");

export const deleteDownload = async (hash: string, deleteFiles: boolean) =>
  call<void>(
    "delete_download",
    { hash, deleteFiles },
    "Failed to delete download",
  );

export const addTorrentAndTrack = async (
  url: string,
  subjectId: number,
  episode: number | null,
  metaJson: string | null,
) =>
  call<void>(
    "add_torrent_and_track",
    { url, subjectId, episode, metaJson },
    "Failed to add download task",
  );

// --- Bangumi ---

export const getCalendar = async () =>
  call<CalendarDay[]>("get_calendar", undefined, "Failed to get calendar");

export const getAnimeDetail = async (id: number) =>
  call<Anime>("get_subject", { id }, `Failed to get anime detail (ID: ${id})`);

export const getEpisodes = async (
  subjectId: number,
  epType?: number,
  limit?: number,
  offset?: number,
) =>
  call<PagedEpisode>(
    "get_episodes",
    { subjectId, epType, limit, offset },
    `Failed to get episodes (Subject ID: ${subjectId})`,
  );

export const getSubjectStatus = async (id: number) =>
  call<SubjectStatus>(
    "get_subject_status",
    { id },
    `Failed to get subject status (ID: ${id})`,
  );

export const searchSubject = async (params: {
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
}) =>
  call<SearchResponse>(
    "search_subject",
    params,
    `Search failed: ${params.keywords}`,
  );

// --- Mikan ---

export const getMikanResources = async (subjectId: number) =>
  call<MikanResourcesResponse>(
    "get_mikan_resources",
    { subjectId },
    `Failed to get Mikan resources (Subject ID: ${subjectId})`,
  );

// --- Subscriptions ---

export const getSubscriptions = async () => {
  const data =
    await call<
      { id: number; anime: Anime; addedAt: number; notify?: boolean }[]
    >("sub_list");
  return Array.isArray(data) ? data : [];
};

export const getSubscriptionIds = async () => {
  const data = await call<number[]>("sub_list_ids");
  return Array.isArray(data) ? data : [];
};

export const hasSubscription = async (id: number) => {
  const res = await call<boolean>("sub_has", { id });
  return !!res;
};

export const toggleSubscription = async (id: number) => {
  const res = await call<boolean>("sub_toggle", { id });
  return !!res;
};

export const clearSubscriptions = async () => call<void>("sub_clear");

export const querySubscriptions = async (params: {
  keywords: string | null;
  sort: string | null;
  genres: string[] | null;
  min_rating: number | null;
  max_rating: number | null;
  status_code: SubjectStatusCode | null;
  limit: number | null;
  offset: number | null;
}) =>
  call<SearchResponse>(
    "sub_query",
    { params },
    "Failed to query subscriptions",
  );
