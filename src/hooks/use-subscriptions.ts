import { useQueryClient } from '@tanstack/react-query';
import { useSimpleQuery } from './use-simple-query';
import {
  getSubscriptions,
  getSubscriptionIds,
  toggleSubscription,
  clearSubscriptions,
} from '../lib/api';
import { Anime } from '../types/bangumi';

type SubscriptionItem = {
  id: number;
  anime: Anime;
  addedAt: number;
  notify?: boolean;
};

export function useSubscriptions(opts?: { mode?: 'full' | 'ids' }) {
  const mode = opts?.mode ?? 'full';
  const queryClient = useQueryClient();

  // 查询完整列表
  const fullQuery = useSimpleQuery<SubscriptionItem[]>({
    queryKey: ['subscriptions', 'full'],
    queryFn: getSubscriptions,
    enabled: mode === 'full',
  });

  // 查询 ID 列表
  const idsQuery = useSimpleQuery<number[]>({
    queryKey: ['subscriptions', 'ids'],
    queryFn: getSubscriptionIds,
    enabled: mode === 'ids',
  });

  const items = fullQuery.data ?? [];

  const isSubscribed = (id: number) => {
    if (mode === 'full') {
      return items.some((x) => x.id === id);
    }
    return idsQuery.data?.includes(id) ?? false;
  };

  const toggle = async (anime: Anime) => {
    try {
      const result = await toggleSubscription(anime.id);
      // Invalidate both queries to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      return result;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const clear = async () => {
    try {
      await clearSubscriptions();
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
    } catch (e) {
      console.error(e);
    }
  };

  return {
    items,
    list: items.map((x) => x.anime),
    isSubscribed,
    toggle,
    clear,
  };
}
