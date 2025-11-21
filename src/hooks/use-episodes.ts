import { useCallback, useState } from 'react';
import { getEpisodes } from '../lib/api';
import { PagedEpisode } from '../types/bangumi';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useToastOnError } from './use-toast-on-error';

// 分页常量定义
const PAGE_LIMIT = 18;
const UI_LIMIT = 6;
const SUBS_PER_BASE = PAGE_LIMIT / UI_LIMIT;

export const useEpisodes = (subjectId: number | undefined) => {
  const [pageBase, setPageBase] = useState(0);
  const [subIndex, setSubIndex] = useState(0);
  const queryClient = useQueryClient();

  const query = useInfiniteQuery<PagedEpisode>({
    queryKey: ['episodes', subjectId, pageBase, PAGE_LIMIT],
    queryFn: async ({ pageParam }) => {
      if (!subjectId) {
        return { total: 0, limit: PAGE_LIMIT, offset: 0, data: [] };
      }
      const result = await getEpisodes(subjectId, undefined, PAGE_LIMIT, pageParam as number);
      const processed = (result.data || [])
        .sort((a, b) => a.disc - b.disc || a.sort - b.sort)
        .filter((e) => e.type === 0 && e.ep !== null)
        .map((e) => ({
          ...e,
          comment_str: e.comment.toLocaleString(),
          duration_display: e.duration || 'N/A',
        }));
      return { ...result, data: processed };
    },
    initialPageParam: pageBase * PAGE_LIMIT,
    getNextPageParam: (lastPage) => {
      const nextOffset = (lastPage.offset ?? 0) + (lastPage.limit ?? PAGE_LIMIT);
      return nextOffset < (lastPage.total ?? 0) ? nextOffset : undefined;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
    enabled: !!subjectId,
    placeholderData: (prev) => prev,
  });

  // 使用统一的错误提示钩子
  useToastOnError({
    error: query.error,
    onRetry: () => queryClient.refetchQueries({ queryKey: ['episodes', subjectId, pageBase, PAGE_LIMIT], exact: true })
  });


  const jumpToPage = useCallback((page: number) => {
    const lastTotal = query.data?.pages?.[query.data.pages.length - 1]?.total ?? 0;
    const tp = Math.ceil(lastTotal / UI_LIMIT);
    if (page >= 0 && page < tp && !query.isFetching) {
      const targetBase = Math.floor(page / SUBS_PER_BASE);
      const targetSub = page % SUBS_PER_BASE;
      setSubIndex(targetSub);
      setPageBase(targetBase);
    }
  }, [query.data, query.isFetching]);

  // 重新加载当前页
  const reload = useCallback(() => {
    query.refetch();
  }, [query]);


  const last = query.data?.pages?.[query.data.pages.length - 1];
  const totalEpisodes = last?.total ?? 0;
  const totalPages = Math.ceil(totalEpisodes / UI_LIMIT);
  const currentPage = Math.min(totalPages - 1, pageBase * SUBS_PER_BASE + subIndex);
  const start = subIndex * UI_LIMIT;
  const end = start + UI_LIMIT;
  const pageEpisodes = (last?.data ?? []).slice(start, end);

  const loadNextPage = useCallback(() => {
    const next = currentPage + 1;
    if (next < totalPages && !query.isFetching) {
      jumpToPage(next);
    }
  }, [currentPage, totalPages, query.isFetching, jumpToPage]);

  const loadPreviousPage = useCallback(() => {
    const prev = currentPage - 1;
    if (prev >= 0 && !query.isFetching) {
      jumpToPage(prev);
    }
  }, [currentPage, query.isFetching, jumpToPage]);

  return {
    episodes: pageEpisodes,
    loading: query.isFetching,
    error: query.error ? (query.error as Error).message : null,
    currentPage,
    totalPages,
    totalEpisodes,
    hasMore: currentPage + 1 < totalPages,
    loadNextPage,
    loadPreviousPage,
    jumpToPage,
    reload,
  };
};
