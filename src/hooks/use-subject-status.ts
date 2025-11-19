import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getSubjectStatus } from '../lib/api';
import type { SubjectStatus } from '../types/bangumi';
import { useToastOnError } from './use-toast-on-error';

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

  // 使用统一的错误提示钩子
  useToastOnError({
    error: query.error,
    onRetry: () => queryClient.refetchQueries({ queryKey: ['subject-status', id], exact: true }),
    // 只有当id存在时才显示错误
    title: '获取状态失败'
  });

  return {
    status: query.data ?? null,
    loading: query.isPending,
    error: query.error ? (query.error as Error).message : null,
    reload: query.refetch,
  };
}