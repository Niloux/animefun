import { useCallback, useState } from 'react';
import { getEpisodes } from '../lib/api';
import { PagedEpisode } from '../types/bangumi';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useToastOnError } from './use-toast-on-error';

// 分页常量定义
const PAGE_LIMIT = 18; // 每页展示 18 条（3 行 × 每行 6 条）

export const useEpisodes = (subjectId: number | undefined) => {
  const [pageBase, setPageBase] = useState(0);
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


  // 加载下一页
  const loadNextPage = useCallback(() => {
    if (query.hasNextPage && !query.isFetching) {
      query.fetchNextPage();
    }
  }, [query]);

  // 加载上一页
  const loadPreviousPage = useCallback(() => {
    if (pageBase > 0 && !query.isFetching) {
      setPageBase((p) => Math.max(0, p - 1));
    }
  }, [pageBase, query.isFetching]);

  // 跳转到指定页
  const jumpToPage = useCallback((page: number) => {
    const lastTotal = query.data?.pages?.[query.data.pages.length - 1]?.total ?? 0;
    const tp = Math.ceil(lastTotal / PAGE_LIMIT);
    if (page >= 0 && page < tp && !query.isFetching) {
      setPageBase(page);
    }
  }, [query.data, query.isFetching]);

  // 重新加载当前页
  const reload = useCallback(() => {
    query.refetch();
  }, [query]);


  const flatEpisodes = (query.data?.pages ?? []).flatMap((p) => p.data ?? []);
  const last = query.data?.pages?.[query.data.pages.length - 1];
  const totalEpisodes = last?.total ?? 0;
  const totalPages = Math.ceil(totalEpisodes / PAGE_LIMIT);
  const currentPage = pageBase + Math.max(0, (query.data?.pages?.length ?? 1) - 1);

  return {
    episodes: flatEpisodes,
    loading: query.isFetching,
    error: query.error ? (query.error as Error).message : null,
    currentPage,
    totalPages,
    totalEpisodes,
    hasMore: !!query.hasNextPage,
    loadNextPage,
    loadPreviousPage,
    jumpToPage,
    reload,
  };
};