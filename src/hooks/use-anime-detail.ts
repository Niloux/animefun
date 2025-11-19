import { getAnimeDetail } from '../lib/api';
import { Anime } from '../types/bangumi';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useEffect } from 'react';

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

  useEffect(() => {
    if (query.error) {
      const msg = (query.error as Error).message;
      toast.error(msg, { duration: 5000, action: { label: '重试', onClick: () => queryClient.refetchQueries({ queryKey: ['anime', id], exact: true }) } });
    }
  }, [query.error, queryClient, id]);

  return {
    anime: query.data ?? null,
    loading: query.isPending,
    error: query.error ? (query.error as Error).message : null,
    reload: query.refetch,
  };
};