import { useState, useEffect, useCallback } from 'react';
import { toast } from "sonner";
import { getAnimeDetail } from '../lib/api';
import { Anime } from '../types/bangumi';

export const useAnimeDetail = (id: string | undefined) => {
  const [anime, setAnime] = useState<Anime | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    loadData();
  }, [id, loadData]);

  return { anime, loading, error, reload: loadData };
};