import { getSubjectStatus } from '../lib/api';
import type { SubjectStatus } from '../types/gen/bangumi';
import { useSimpleQuery } from './use-simple-query';

export function useSubjectStatus(id: number | undefined) {
  const { data, loading, error, reload } = useSimpleQuery<SubjectStatus | null>({
    queryKey: ['subject-status', id],
    queryFn: async () => {
      if (!id) return null;
      return getSubjectStatus(id);
    },
    enabled: !!id,
    errorTitle: '获取状态失败',
  });

  return {
    status: data,
    loading,
    error,
    reload,
  };
}
