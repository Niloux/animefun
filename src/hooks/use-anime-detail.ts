import { getAnimeDetail } from '../lib/api';
import { Anime } from '../types/gen/bangumi';
import { useSimpleQuery } from './use-simple-query';

export const useAnimeDetail = (id: string | undefined) => {
  const { data, loading, error, reload } = useSimpleQuery<Anime | null>({
    queryKey: ['anime', id],
    queryFn: async () => {
      if (!id) return null;
      return getAnimeDetail(Number(id));
    },
    enabled: !!id,
  });

  return {
    anime: data,
    loading,
    error,
    reload,
  };
};
