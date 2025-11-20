import { useCallback, useEffect, useMemo, useState } from "react";
import { Anime } from "../types/bangumi";
import { getSubscriptions, getSubscriptionIds, toggleSubscription, clearSubscriptions } from "../lib/api";

type SubscriptionItem = {
  id: number;
  anime: Anime;
  addedAt: number;
  notify?: boolean;
};

export function useSubscriptions(opts?: { mode?: "full" | "ids" }) {
  const mode = opts?.mode ?? "full";
  const [items, setItems] = useState<SubscriptionItem[]>([]);
  const [ids, setIds] = useState<number[]>([]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        if (mode === "full") {
          const data = await getSubscriptions();
          if (mounted) setItems(Array.isArray(data) ? data : []);
        } else {
          const data = await getSubscriptionIds();
          if (mounted) setIds(Array.isArray(data) ? data : []);
        }
      } catch (e) {
        console.error(e);
        if (mounted) {
          setItems([]);
          setIds([]);
        }
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [mode]);

  const isSubscribed = useCallback(
    (id: number) =>
      (ids.length > 0 ? ids.includes(id) : items.some((x) => x.id === id)),
    [ids, items]
  );

  const toggle = useCallback(async (anime: Anime): Promise<boolean> => {
    try {
      const subscribed = await toggleSubscription(anime.id);
      if (subscribed) {
        setItems((prev) => [{ id: anime.id, anime, addedAt: Date.now() }, ...prev.filter((x) => x.id !== anime.id)]);
        setIds((prev) => (prev.includes(anime.id) ? prev : [anime.id, ...prev]));
      } else {
        setItems((prev) => prev.filter((x) => x.id !== anime.id));
        setIds((prev) => prev.filter((x) => x !== anime.id));
      }
      return subscribed;
    } catch (e) {
      console.error(e);
      throw e as Error;
    }
  }, []);

  const list = useMemo(() => items.map((x) => x.anime), [items]);

  const clear = useCallback(() => {
    (async () => {
      try {
        await clearSubscriptions();
        setItems([]);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  return { items, list, isSubscribed, toggle, clear };
}
