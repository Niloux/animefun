import { useState } from 'react';
import { getEpisodes } from '../lib/api';
import { useSimpleQuery } from './use-simple-query';
import { Episode } from '../types/gen/bangumi';

export const useEpisodes = (subjectId: number | undefined) => {
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 6;

  const { data, isFetching, error, reload } = useSimpleQuery({
    queryKey: ['episodes', subjectId],
    queryFn: async () => {
      if (!subjectId) return [];
      // 一次性加载 1000 条，假设这足以覆盖绝大多数番剧
      const result = await getEpisodes(subjectId, undefined, 1000, 0);
      const items: Episode[] = (result.data || [])
        .sort((a: Episode, b: Episode) => a.disc - b.disc || a.sort - b.sort)
        .filter((e: Episode) => e.type === 0 && e.ep !== null);
      return items;
    },
    enabled: !!subjectId,
  });

  const episodes = data ?? [];
  const totalEpisodes = episodes.length;
  const totalPages = Math.ceil(totalEpisodes / PAGE_SIZE);

  // 确保 page 不越界
  const currentPage = totalPages > 0 ? Math.min(page, totalPages - 1) : 0;

  const start = currentPage * PAGE_SIZE;
  const pageEpisodes = episodes.slice(start, start + PAGE_SIZE);

  const jumpToPage = (p: number) => {
    if (p >= 0 && p < totalPages) {
      setPage(p);
    }
  };

  const loadNextPage = () => jumpToPage(currentPage + 1);
  const loadPreviousPage = () => jumpToPage(currentPage - 1);

  return {
    episodes: pageEpisodes,
    loading: isFetching,
    error,
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
