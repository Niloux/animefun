import { useCallback } from 'react';
import { getAnimeDetail } from '../lib/api';
import { Anime } from '../types/bangumi';
import { useQuery } from '@tanstack/react-query';

export const useAnimeDetail = (id: string | undefined) => {

  // 辅助函数：提取value的实际内容（迭代实现，避免嵌套过深导致栈溢出）
  const extractValue = useCallback((value: unknown): string => {
    const stack: unknown[] = [value];
    const results: string[] = [];

    while (stack.length > 0) {
      const current = stack.pop();

      if (current === null || current === undefined) {
        continue;
      }

      // 字符串直接收集
      if (typeof current === 'string') {
        results.push(current);
        continue;
      }

      // 包含v键的对象 - 压入v的值继续处理
      if (typeof current === 'object' && !Array.isArray(current)) {
        const obj = current as Record<string, unknown>;
        if ('v' in obj) {
          stack.push(obj.v);
          continue;
        }
      }

      // 数组 - 将所有元素压入栈
      if (Array.isArray(current)) {
        // 倒序压入保持原有顺序
        for (let i = current.length - 1; i >= 0; i--) {
          stack.push(current[i]);
        }
        continue;
      }

      // 其他类型转换为字符串
      try {
        results.push(String(current));
      } catch {
        continue;
      }
    }

    return results.filter(Boolean).join('、');
  }, []);

  const query = useQuery<Anime | null>({
    queryKey: ['anime', id],
    queryFn: async () => {
      if (!id) return null;
      const data = await getAnimeDetail(Number(id));
      const processed = {
        ...data,
        infobox: Array.isArray(data.infobox)
          ? data.infobox.map((item) => ({
              ...item,
              value: extractValue(item.value),
            }))
          : [],
      };
      return processed as Anime;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
  });

  return {
    anime: (query.data as Anime | null) ?? null,
    loading: query.isPending,
    error: query.error ? (query.error as Error).message : null,
    reload: query.refetch,
  };
};