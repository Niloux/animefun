import { invoke } from '@tauri-apps/api/core';
import { CalendarDay } from '../types/bangumi';

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

// 未来所有与后端交互的函数都应放在这里
