import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { getEpisodes } from '../lib/api';
import { Episode } from '../types/bangumi';

// 分页常量定义
const PAGE_LIMIT = 18; // 每页展示 18 条（3 行 × 每行 6 条）

export const useEpisodes = (subjectId: number | undefined) => {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalEpisodes, setTotalEpisodes] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const totalPages = Math.ceil(totalEpisodes / PAGE_LIMIT);

  const loadData = useCallback(async (page = 0, append = false) => {
    if (!subjectId) {
      setEpisodes([]);
      setLoading(false);
      setError(null);
      setTotalEpisodes(0);
      setHasMore(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);

      // 根据页码计算偏移量
      const offset = page * PAGE_LIMIT;

      // 按分页获取剧集数据
      const result = await getEpisodes(subjectId, undefined, PAGE_LIMIT, offset);

      // 处理并过滤剧集（仅保留正片）
      const processedEpisodes = (result.data || [])
        .sort((a, b) => a.disc - b.disc || a.sort - b.sort)
        .filter(e => e.type === 0 && e.ep !== null)
        .map(e => ({
          ...e,
          comment_str: e.comment.toLocaleString(),
          duration_display: e.duration || 'N/A',
        }));

      // 根据是否为追加模式更新状态
      if (append) {
        setEpisodes(prev => [...prev, ...processedEpisodes]);
      } else {
        setEpisodes(processedEpisodes);
      }

      // 更新分页相关状态
      setTotalEpisodes(result.total || 0);
      setCurrentPage(page);
      setHasMore(offset + PAGE_LIMIT < result.total);

    } catch (err) {
      const msg = err instanceof Error ? err.message : '加载剧集失败';
      setError(msg);

      // 非追加模式才清空已加载的剧集
      if (!append) {
        setEpisodes([]);
      }

      toast.error(msg, { duration: 5000, action: { label: '重试', onClick: () => loadData(page, append) } });
    } finally {
      setLoading(false);
    }
  }, [subjectId]);

  useEffect(() => {
    // 当番剧 ID 变化时重置分页并重新加载
    setCurrentPage(0);
    loadData(0, false);
  }, [subjectId, loadData]);

  // 加载下一页
  const loadNextPage = useCallback(() => {
    if (hasMore && !loading) {
      loadData(currentPage + 1, true);
    }
  }, [hasMore, loading, currentPage, loadData]);

  // 加载上一页
  const loadPreviousPage = useCallback(() => {
    if (currentPage > 0 && !loading) {
      loadData(currentPage - 1, false);
    }
  }, [currentPage, loading, loadData]);

  // 跳转到指定页
  const jumpToPage = useCallback((page: number) => {
    if (page >= 0 && page < totalPages && !loading) {
      loadData(page, false);
    }
  }, [totalPages, loading, loadData]);

  // 重新加载当前页
  const reload = useCallback(() => {
    loadData(currentPage, false);
  }, [currentPage, loadData]);


  return {
    episodes,
    loading,
    error,
    currentPage,
    totalPages,
    totalEpisodes,
    hasMore,
    loadNextPage,
    loadPreviousPage,
    jumpToPage,
    reload
  };
};