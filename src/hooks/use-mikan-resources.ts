import { getMikanResources } from "../lib/api";
import type { MikanResourcesResponse } from "../types/gen/mikan";
import { useSimpleQuery } from "./use-simple-query";

export function useMikanResources(subjectId: number | undefined) {
  const { data, isFetching, error, reload } =
    useSimpleQuery<MikanResourcesResponse | null>({
      queryKey: ["mikan", subjectId],
      queryFn: async () => {
        if (!subjectId) return null;
        return getMikanResources(subjectId);
      },
      enabled: !!subjectId,
      retry: 1,
      placeholderData: (prev) => prev,
      errorTitle: "资源拉取失败",
    });

  return {
    data,
    loading: isFetching, // 原代码使用 isFetching
    error,
    refetch: reload,
  };
}

export default useMikanResources;
