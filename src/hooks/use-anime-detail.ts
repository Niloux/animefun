import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from "sonner";
import { getAnimeDetail } from '../lib/api';
import { Anime } from '../types/bangumi';

export const useAnimeDetail = (id: string | undefined) => {
  const [anime, setAnime] = useState<Anime | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false); // 用于防止StrictMode下的重复请求

  // 辅助函数：提取value的实际内容
  const extractValue = useCallback((value: unknown): string => {
    if (value === null || value === undefined) {
      return '';
    }

    // 字符串直接返回
    if (typeof value === 'string') {
      return value;
    }

    // 包含v键的对象
    if (typeof value === 'object' && !Array.isArray(value) && 'v' in value) {
      return extractValue((value as Record<string, unknown>).v);
    }

    // 数组，将多个值用顿号连接
    if (Array.isArray(value)) {
      return value.map(item => extractValue(item)).filter(Boolean).join('、');
    }

    // 其他类型转换为字符串
    try {
      return String(value);
    } catch {
      return '';
    }
  }, []);

  const loadData = useCallback(async () => {
    if (!id) {
      setAnime(null);
      setLoading(false);
      setError(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await getAnimeDetail(Number(id));

      // 检查并处理infobox数据
      const processedData = {
        ...data,
        infobox: Array.isArray(data.infobox) ? data.infobox.map(item => ({
          ...item,
          value: extractValue(item.value),
        })) : [],
      };

      setAnime(processedData);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '获取番剧详情失败';
      setError(errorMsg);
      setAnime(null);
      toast.error(errorMsg, {
        duration: 5000,
        action: {
          label: "重试",
          onClick: () => loadData(),
        },
      });
    } finally {
      setLoading(false);
    }
  }, [id, extractValue]);

  // 组件挂载或id变化时加载数据 - 防止StrictMode下的重复请求
  useEffect(() => {
    hasLoadedRef.current = false;
    loadData();
  }, [id, loadData]);

  return { anime, loading, error, reload: loadData };
};