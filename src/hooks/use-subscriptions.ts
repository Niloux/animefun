import { useCallback, useEffect, useMemo, useState } from "react";
import { Anime } from "../types/bangumi";
import { invoke } from "@tauri-apps/api/core";

type SubscriptionItem = {
  id: number;
  anime: Anime;
  addedAt: number;
  notify?: boolean;
};

export function useSubscriptions() {
  const [items, setItems] = useState<SubscriptionItem[]>([]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const data = await invoke<SubscriptionItem[]>("sub_list");
        if (mounted) setItems(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error(e);
        if (mounted) setItems([]);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const isSubscribed = useCallback(
    (id: number) => items.some((x) => x.id === id),
    [items]
  );

  const toggle = useCallback((anime: Anime) => {
    (async () => {
      try {
        const subscribed = await invoke<boolean>("sub_toggle", { id: anime.id });
        if (subscribed) {
          setItems((prev) => [{ id: anime.id, anime, addedAt: Date.now() }, ...prev.filter((x) => x.id !== anime.id)]);
        } else {
          setItems((prev) => prev.filter((x) => x.id !== anime.id));
        }
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  const list = useMemo(() => items.map((x) => x.anime), [items]);

  const clear = useCallback(() => {
    (async () => {
      try {
        await invoke<void>("sub_clear");
        setItems([]);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  return { items, list, isSubscribed, toggle, clear };
}