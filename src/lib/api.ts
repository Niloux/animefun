import { invoke } from "@tauri-apps/api/core";
import { DownloadItem } from "@/types/gen/downloader";
import { TorrentInfo } from "@/types/gen/torrent_info";

// ... existing imports

export async function getTrackedDownloads(): Promise<DownloadItem[]> {
  try {
    return await invoke<DownloadItem[]>("get_tracked_downloads");
  } catch (error) {
    console.error("调用 'get_tracked_downloads' 失败:", error);
    throw new Error("获取下载列表失败");
  }
}

export async function getLiveDownloadInfo(): Promise<TorrentInfo[]> {
  try {
    return await invoke<TorrentInfo[]>("get_live_download_info");
  } catch (error) {
    console.error("调用 'get_live_download_info' 失败:", error);
    throw new Error("获取下载信息失败");
  }
}

export async function pauseDownload(hash: string): Promise<void> {
  try {
    await invoke("pause_download", { hash });
  } catch (error) {
    console.error("调用 'pause_download' 失败:", error);
    throw new Error("暂停下载失败");
  }
}

export async function resumeDownload(hash: string): Promise<void> {
  try {
    await invoke("resume_download", { hash });
  } catch (error) {
    console.error("调用 'resume_download' 失败:", error);
    throw new Error("恢复下载失败");
  }
}

export async function deleteDownload(
  hash: string,
  deleteFiles: boolean,
): Promise<void> {
  try {
    await invoke("delete_download", { hash, deleteFiles });
  } catch (error) {
    console.error("调用 'delete_download' 失败:", error);
    throw new Error("删除下载失败");
  }
}
import {
  CalendarDay,
  Anime,
  PagedEpisode,
  SubjectStatus,
  SubjectStatusCode,
} from "../types/bangumi";
import type { MikanResourcesResponse } from "@/types/gen/mikan";
import type { SearchResponse } from "@/types/gen/bangumi";

/**
 * 从后端获取番剧日历数据
 * @returns Promise<CalendarDay[]> 日历数据
 * @throws 如果调用失败，则抛出错误
 */
export async function getCalendar(): Promise<CalendarDay[]> {
  try {
    const data = await invoke<CalendarDay[]>("get_calendar");
    return data;
  } catch (error) {
    console.error("调用 'get_calendar' 失败:", error);
    // 向上抛出一个更通用的错误，让调用方（比如Hook）来决定如何处理UI
    throw new Error("从后端获取日历数据失败");
  }
}

/**
 * 从后端获取番剧详情
 * @param id 番剧ID
 * @returns Promise<Anime> 番剧详情数据
 * @throws 如果调用失败，则抛出错误
 */
export async function getAnimeDetail(id: number): Promise<Anime> {
  try {
    const data = await invoke<Anime>("get_subject", { id });
    return data;
  } catch (error) {
    console.error("调用 'get_subject' 失败:", error);
    throw new Error(`获取番剧详情失败 (ID: ${id})`);
  }
}

/**
 * 从后端获取剧集列表
 * @param subjectId 番剧ID
 * @param epType 剧集类型（可选）
 * @param limit 每页数量（可选）
 * @param offset 偏移量（可选）
 * @returns Promise<any> 剧集列表数据
 * @throws 如果调用失败，则抛出错误
 */
export async function getEpisodes(
  subjectId: number,
  epType?: number,
  limit?: number,
  offset?: number,
): Promise<PagedEpisode> {
  try {
    const data = await invoke<PagedEpisode>("get_episodes", {
      subjectId,
      epType,
      limit,
      offset,
    });
    return data;
  } catch (error) {
    console.error("调用 'get_episodes' 失败:", error);
    throw new Error(`获取剧集列表失败 (Subject ID: ${subjectId})`);
  }
}

export async function getSubjectStatus(id: number): Promise<SubjectStatus> {
  try {
    const data = await invoke<SubjectStatus>("get_subject_status", { id });
    return data;
  } catch (error) {
    console.error("调用 'get_subject_status' 失败:", error);
    throw new Error(`获取番剧状态失败 (ID: ${id})`);
  }
}

/**
 * 从后端搜索番剧
 * @param keywords 搜索关键词
 * @param subjectType 条目类型（可选）
 * @param sort 排序规则（可选）
 * @param tag 标签（可选）
 * @param airDate 播出日期（可选）
 * @param rating 评分（可选）
 * @param ratingCount 评分人数（可选）
 * @param rank 排名（可选）
 * @param nsfw 是否包含NSFW内容（可选）
 * @param limit 每页数量（可选）
 * @param offset 偏移量（可选）
 * @returns Promise<{ total: number; limit: number; offset: number; data: Anime[] }> 搜索结果
 * @throws 如果调用失败，则抛出错误
 */
export async function searchSubject(
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
): Promise<{ total: number; limit: number; offset: number; data: Anime[] }> {
  try {
    const data = await invoke<{
      total: number;
      limit: number;
      offset: number;
      data: Anime[];
    }>("search_subject", {
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
    });
    return data;
  } catch (error) {
    console.error("调用 'search_subject' 失败:", error);
    throw new Error(`搜索番剧失败: ${keywords}`);
  }
}

export async function getMikanResources(
  subjectId: number,
): Promise<MikanResourcesResponse> {
  try {
    const data = await invoke<MikanResourcesResponse>("get_mikan_resources", {
      subjectId,
    });
    return data;
  } catch (error) {
    console.error("调用 'get_mikan_resources' 失败:", error);
    throw new Error(`获取 Mikan 资源失败 (Subject ID: ${subjectId})`);
  }
}

export async function searchSubjectQ(params: {
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
}): Promise<SearchResponse> {
  const data = await invoke<SearchResponse>("search_subject", params);
  return data;
}

export async function addTorrentAndTrack(
  url: string,
  subjectId: number,
  episode: number | null,
  metaJson: string | null,
): Promise<void> {
  try {
    await invoke("add_torrent_and_track", {
      url,
      subjectId,
      episode,
      metaJson,
    });
  } catch (error) {
    console.error("调用 'add_torrent_and_track' 失败:", error);
    throw new Error("添加下载任务失败: " + String(error));
  }
}

export async function getSubscriptions(): Promise<
  { id: number; anime: Anime; addedAt: number; notify?: boolean }[]
> {
  const data =
    await invoke<
      { id: number; anime: Anime; addedAt: number; notify?: boolean }[]
    >("sub_list");
  return Array.isArray(data) ? data : [];
}

export async function getSubscriptionIds(): Promise<number[]> {
  const data = await invoke<number[]>("sub_list_ids");
  return Array.isArray(data) ? data : [];
}

export async function hasSubscription(id: number): Promise<boolean> {
  const res = await invoke<boolean>("sub_has", { id });
  return !!res;
}

export async function toggleSubscription(id: number): Promise<boolean> {
  const res = await invoke<boolean>("sub_toggle", { id });
  return !!res;
}

export async function clearSubscriptions(): Promise<void> {
  await invoke<void>("sub_clear");
}

export async function querySubscriptions(
  keywords: string,
  sort: string,
  genres: string[],
  minRating: number,
  maxRating: number,
  statusCode: SubjectStatusCode | null,
  limit: number,
  offset: number,
): Promise<{ total: number; limit: number; offset: number; data: Anime[] }> {
  const data = await invoke<{
    total: number;
    limit: number;
    offset: number;
    data: Anime[];
  }>("sub_query", {
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
  });
  return data;
}

export async function querySubscriptionsQ(params: {
  keywords: string | null;
  sort: string | null;
  genres: string[] | null;
  min_rating: number | null;
  max_rating: number | null;
  status_code: SubjectStatusCode | null;
  limit: number | null;
  offset: number | null;
}): Promise<SearchResponse> {
  const data = await invoke<SearchResponse>("sub_query", { params });
  return data;
}
