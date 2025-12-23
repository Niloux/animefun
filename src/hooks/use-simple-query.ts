import { useQuery, useQueryClient, UseQueryOptions, QueryKey } from '@tanstack/react-query';
import { useToastOnError } from './use-toast-on-error';

export type UseSimpleQueryOptions<TData, TError = unknown> = {
  queryKey: QueryKey;
  queryFn: () => Promise<TData>;
  enabled?: boolean;
  staleTime?: number;
  gcTime?: number;
  retry?: number;
  errorTitle?: string;
  placeholderData?: UseQueryOptions<TData, TError>['placeholderData'];
};

export function useSimpleQuery<TData = unknown, TError = unknown>(
  options: UseSimpleQueryOptions<TData, TError>
) {
  const queryClient = useQueryClient();

  const query = useQuery<TData, TError>({
    queryKey: options.queryKey,
    queryFn: options.queryFn,
    enabled: options.enabled ?? true,
    staleTime: options.staleTime ?? 5 * 60 * 1000,
    gcTime: options.gcTime ?? 10 * 60 * 1000,
    retry: options.retry ?? 2,
    placeholderData: options.placeholderData,
  });

  useToastOnError({
    error: query.error,
    onRetry: () =>
      queryClient.refetchQueries({ queryKey: options.queryKey, exact: true }),
    title: options.errorTitle ?? '请求失败',
  });

  return {
    data: query.data ?? null,
    loading: query.isPending,
    isFetching: query.isFetching,
    error: query.error
      ? (query.error instanceof Error
        ? query.error.message
        : String(query.error))
      : null,
    reload: query.refetch,
    query, // 暴露原始 query 以便获取更多状态
  };
}
