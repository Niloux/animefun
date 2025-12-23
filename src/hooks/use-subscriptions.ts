import { useCallback, useEffect, useMemo, useState } from "react";
import { Anime } from "../types/bangumi";
import {
  getSubscriptions,
  getSubscriptionIds,
  toggleSubscription,
  clearSubscriptions,
} from "../lib/api";

type SubscriptionItem = {
  id: number;
  anime: Anime;
  addedAt: number;
  notify?: boolean;
};

export function useSubscriptions(opts?: { mode?: "full" | "ids" }) {
  const mode = opts?.mode ?? "full";
  const [items, setItems] = useState<SubscriptionItem[]>([]);
  const [idSet, setIdSet] = useState<Set<number>>(new Set());

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        if (mode === "full") {
          const data = await getSubscriptions();
          if (mounted) {
            const arr = Array.isArray(data) ? data : [];
            setItems(arr);
            setIdSet(new Set(arr.map((x) => x.id)));
          }
        } else {
          const data = await getSubscriptionIds();
          if (mounted) setIdSet(new Set(Array.isArray(data) ? data : []));
        }
      } catch (e) {
        console.error(e);
        if (mounted) {
          setItems([]);
          setIdSet(new Set());
        }
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [mode]);

  const isSubscribed = useCallback((id: number) => idSet.has(id), [idSet]);

  const toggle = useCallback(async (anime: Anime): Promise<boolean> => {
    const subscribed = await toggleSubscription(anime.id);
    if (subscribed) {
      setItems((prev) => [
        { id: anime.id, anime, addedAt: Date.now() },
        ...prev.filter((x) => x.id !== anime.id),
      ]);
      setIdSet((prev) => {
        const next = new Set(prev);
        next.add(anime.id);
        return next;
      });
    } else {
      setItems((prev) => prev.filter((x) => x.id !== anime.id));
      setIdSet((prev) => {
        const next = new Set(prev);
        next.delete(anime.id);
        return next;
      });
    }
    return subscribed;
  }, []);

  const list = useMemo(() => items.map((x) => x.anime), [items]);

  const clear = useCallback(() => {
    (async () => {
      try {
        await clearSubscriptions();
        setItems([]);
        setIdSet(new Set());
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  return { items, list, isSubscribed, toggle, clear };
}
