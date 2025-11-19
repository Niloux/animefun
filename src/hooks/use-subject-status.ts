import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getSubjectStatus } from '../lib/api';
import type { SubjectStatus } from '../types/bangumi';
import { toast } from 'sonner';

export function useSubjectStatus(id: number | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery<SubjectStatus | null>({
    queryKey: ['subject-status', id],
    queryFn: async () => {
      if (!id) return null;
      const data = await getSubjectStatus(id);
      return data;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
  });

  useEffect(() => {
    if (query.error && id) {
      const msg = (query.error as Error).message;
      toast.error(msg, {
        duration: 5000,
        action: {
          label: '重试',
          onClick: () => queryClient.refetchQueries({ queryKey: ['subject-status', id], exact: true }),
        },
      });
    }
  }, [query.error, queryClient, id]);

  return {
    status: query.data ?? null,
    loading: query.isPending,
    error: query.error ? (query.error as Error).message : null,
    reload: query.refetch,
  };
}