import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getMikanResources } from "../lib/api";
import type { MikanResourcesResponse } from "../types/gen/mikan";
import { useToastOnError } from "./use-toast-on-error";

export function useMikanResources(subjectId: number | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery<MikanResourcesResponse | null>({
    queryKey: ["mikan", subjectId],
    enabled: !!subjectId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    queryFn: async () => {
      if (!subjectId) return null;
      const data = await getMikanResources(subjectId);
      return data;
    },
    placeholderData: (prev) => prev,
  });

  useToastOnError({
    error: query.error,
    title: "资源拉取失败",
    onRetry: () => queryClient.refetchQueries({ queryKey: ["mikan", subjectId], exact: true }),
  });

  return {
    data: query.data ?? null,
    loading: query.isFetching,
    error: query.error ? (query.error as Error).message : null,
    refetch: query.refetch,
  };
}

export default useMikanResources;
