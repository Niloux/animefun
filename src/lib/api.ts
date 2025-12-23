import { invoke } from "@tauri-apps/api/core";
import { DownloadItem } from "@/types/gen/downloader";
import { TorrentInfo } from "@/types/gen/torrent_info";
import {
  CalendarDay,
  Anime,
  PagedEpisode,
  SubjectStatus,
  SubjectStatusCode,
} from "../types/bangumi";
import type { MikanResourcesResponse } from "@/types/gen/mikan";
import type { SearchResponse } from "@/types/gen/bangumi";

async function invokeWithErrorHandling<T>(
  command: string,
  args?: Record<string, unknown>,
  errorMsg?: string,
): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    console.error(`调用 '${command}' 失败:`, error);
    throw new Error(errorMsg ?? `命令 '${command}' 执行失败`);
  }
}

export const getTrackedDownloads = () =>
  invokeWithErrorHandling<DownloadItem[]>(
    "get_tracked_downloads",
    undefined,
    "获取下载列表失败",
  );

export const getLiveDownloadInfo = () =>
  invokeWithErrorHandling<TorrentInfo[]>(
    "get_live_download_info",
    undefined,
    "获取下载信息失败",
  );

export const pauseDownload = (hash: string) =>
  invokeWithErrorHandling("pause_download", { hash }, "暂停下载失败");

export const resumeDownload = (hash: string) =>
  invokeWithErrorHandling("resume_download", { hash }, "恢复下载失败");

export const deleteDownload = (hash: string, deleteFiles: boolean) =>
  invokeWithErrorHandling(
    "delete_download",
    { hash, deleteFiles },
    "删除下载失败",
  );

export const getCalendar = () =>
  invokeWithErrorHandling<CalendarDay[]>(
    "get_calendar",
    undefined,
    "从后端获取日历数据失败",
  );

export const getAnimeDetail = (id: number) =>
  invokeWithErrorHandling<Anime>(
    "get_subject",
    { id },
    `获取番剧详情失败 (ID: ${id})`,
  );

export const getEpisodes = (
  subjectId: number,
  epType?: number,
  limit?: number,
  offset?: number,
) =>
  invokeWithErrorHandling<PagedEpisode>(
    "get_episodes",
    { subjectId, epType, limit, offset },
    `获取剧集列表失败 (Subject ID: ${subjectId})`,
  );

export const getSubjectStatus = (id: number) =>
  invokeWithErrorHandling<SubjectStatus>(
    "get_subject_status",
    { id },
    `获取番剧状态失败 (ID: ${id})`,
  );

export const searchSubject = (
  keywords: string,
  subjectType?: number[],
  sort?: string,
  tag?: string[],
  airDate?: string[],
  rating?: string[],
  ratingCount?: string[],
  rank?: string[],
  nsfw?: boolean,
  limit?: number,
  offset?: number,
) =>
  invokeWithErrorHandling<{
    total: number;
    limit: number;
    offset: number;
    data: Anime[];
  }>(
    "search_subject",
    {
      keywords,
      subjectType,
      sort,
      tag,
      airDate,
      rating,
      ratingCount,
      rank,
      nsfw,
      limit,
      offset,
    },
    `搜索番剧失败: ${keywords}`,
  );

export const getMikanResources = (subjectId: number) =>
  invokeWithErrorHandling<MikanResourcesResponse>(
    "get_mikan_resources",
    { subjectId },
    `获取 Mikan 资源失败 (Subject ID: ${subjectId})`,
  );

export const searchSubjectQ = (params: {
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

export const addTorrentAndTrack = (
  url: string,
  subjectId: number,
  episode: number | null,
  metaJson: string | null,
) =>
  invokeWithErrorHandling(
    "add_torrent_and_track",
    { url, subjectId, episode, metaJson },
    "添加下载任务失败",
  );

export const getSubscriptions = () =>
  invoke<{ id: number; anime: Anime; addedAt: number; notify?: boolean }[]>(
    "sub_list",
  ).then((data) => (Array.isArray(data) ? data : []));

export const getSubscriptionIds = () =>
  invoke<number[]>("sub_list_ids").then((data) =>
    Array.isArray(data) ? data : [],
  );

export const hasSubscription = (id: number) =>
  invoke<boolean>("sub_has", { id }).then((res) => !!res);

export const toggleSubscription = (id: number) =>
  invoke<boolean>("sub_toggle", { id }).then((res) => !!res);

export const clearSubscriptions = () => invoke<void>("sub_clear");

export const querySubscriptions = (
  keywords: string,
  sort: string,
  genres: string[],
  minRating: number,
  maxRating: number,
  statusCode: SubjectStatusCode | null,
  limit: number,
  offset: number,
) =>
  invoke<{ total: number; limit: number; offset: number; data: Anime[] }>(
    "sub_query",
    {
      params: {
        keywords,
        sort,
        genres,
        min_rating: minRating,
        max_rating: maxRating,
        status_code: statusCode,
        limit,
        offset,
      },
    },
  );

export const querySubscriptionsQ = (params: {
  keywords: string | null;
  sort: string | null;
  genres: string[] | null;
  min_rating: number | null;
  max_rating: number | null;
  status_code: SubjectStatusCode | null;
  limit: number | null;
  offset: number | null;
}) => invoke<SearchResponse>("sub_query", { params });
