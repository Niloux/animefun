import { getAnimeDetail } from '../lib/api';
import { Anime } from '../types/bangumi';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToastOnError } from './use-toast-on-error';

export const useAnimeDetail = (id: string | undefined) => {
  const queryClient = useQueryClient();

  const query = useQuery<Anime | null>({
    queryKey: ['anime', id],
    queryFn: async () => {
      if (!id) return null;
      const data = await getAnimeDetail(Number(id));
      return data;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
  });

  // 使用统一的错误提示钩子
  useToastOnError({
    error: query.error,
    onRetry: () => queryClient.refetchQueries({ queryKey: ['anime', id], exact: true })
  });

  return {
    anime: query.data ?? null,
    loading: query.isPending,
    error: query.error ? (query.error as Error).message : null,
    reload: query.refetch,
  };
};