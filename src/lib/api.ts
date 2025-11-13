import { invoke } from '@tauri-apps/api/core';
import { CalendarDay, Anime, PagedEpisode } from '../types/bangumi';

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

// 未来所有与后端交互的函数都应放在这里
