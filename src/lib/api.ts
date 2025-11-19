import { invoke } from '@tauri-apps/api/core';
import { CalendarDay, Anime, PagedEpisode, SubjectStatus, SubjectStatusCode } from '../types/bangumi';

/**
 * 从后端获取番剧日历数据
 * @returns Promise<CalendarDay[]> 日历数据
 * @throws 如果调用失败，则抛出错误
 */
export async function getCalendar(): Promise<CalendarDay[]> {
  try {
    const data = await invoke<CalendarDay[]>('get_calendar');
    return data;
  } catch (error) {
    console.error("调用 'get_calendar' 失败:", error);
    // 向上抛出一个更通用的错误，让调用方（比如Hook）来决定如何处理UI
    throw new Error('从后端获取日历数据失败');
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
    const data = await invoke<Anime>('get_subject', { id });
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
  offset?: number
): Promise<PagedEpisode> {
  try {
    const data = await invoke<PagedEpisode>('get_episodes', {
      subjectId,
      epType,
      limit,
      offset
    });
    return data;
  } catch (error) {
    console.error("调用 'get_episodes' 失败:", error);
    throw new Error(`获取剧集列表失败 (Subject ID: ${subjectId})`);
  }
}

export async function getSubjectStatus(id: number): Promise<SubjectStatus> {
  try {
    const data = await invoke<SubjectStatus>('get_subject_status', { id });
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
  offset?: number
): Promise<{ total: number; limit: number; offset: number; data: Anime[] }> {
  try {
    const data = await invoke<{ total: number; limit: number; offset: number; data: Anime[] }>(
      'search_subject',
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
      }
    );
    return data;
  } catch (error) {
    console.error("调用 'search_subject' 失败:", error);
    throw new Error(`搜索番剧失败: ${keywords}`);
  }
}

export async function getSubscriptions(): Promise<{ id: number; anime: Anime; addedAt: number; notify?: boolean }[]> {
  const data = await invoke<{ id: number; anime: Anime; addedAt: number; notify?: boolean }[]>("sub_list");
  return Array.isArray(data) ? data : [];
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
  statusCodes: SubjectStatusCode[],
  limit: number,
  offset: number,
): Promise<{ total: number; limit: number; offset: number; data: Anime[] }> {
  const data = await invoke<{ total: number; limit: number; offset: number; data: Anime[] }>("sub_query", {
    params: {
      keywords,
      sort,
      genres,
      min_rating: minRating,
      max_rating: maxRating,
      status_codes: statusCodes,
      limit,
      offset,
    },
  });
  return data;
}
