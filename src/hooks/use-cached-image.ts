import { useQuery } from "@tanstack/react-query";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";

export function useCachedImage(url?: string | null) {
  const query = useQuery<string | null>({
    queryKey: ["cached-image", url],
    enabled: !!url,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 48 * 60 * 60 * 1000,
    retry: 1,
    queryFn: async () => {
      if (!url) return null;
      try {
        const path = await invoke<string>("cache_image", { url });
        return convertFileSrc(path);
      } catch (e) {
        console.error("缓存图片失败", e);
        return null;
      }
    },
  });

  return {
    src: query.data ?? null,
    loading: query.isPending,
    error: query.error ? (query.error as Error).message : null,
    refetch: query.refetch,
  };
}