import { useCallback, useEffect, useMemo, useState } from "react";
import { Anime } from "../types/bangumi";

type SubscriptionItem = {
  id: number;
  anime: Anime;
  addedAt: number;
  notify?: boolean;
};

const STORAGE_KEY = "animefun.subscriptions";

function read(): SubscriptionItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter((x) => x && typeof x.id === "number" && x.anime);
  } catch {
    return [];
  }
}

function write(items: SubscriptionItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (_e) {
    void _e;
  }
}

export function useSubscriptions() {
  const [items, setItems] = useState<SubscriptionItem[]>(() => read());

  useEffect(() => {
    write(items);
  }, [items]);

  const isSubscribed = useCallback(
    (id: number) => items.some((x) => x.id === id),
    [items]
  );

  const toggle = useCallback((anime: Anime) => {
    setItems((prev) => {
      const idx = prev.findIndex((x) => x.id === anime.id);
      if (idx >= 0) {
        return [...prev.slice(0, idx), ...prev.slice(idx + 1)];
      }
      const item: SubscriptionItem = {
        id: anime.id,
        anime,
        addedAt: Date.now(),
      };
      return [item, ...prev];
    });
  }, []);

  const list = useMemo(() => items.map((x) => x.anime), [items]);

  const clear = useCallback(() => {
    setItems([]);
  }, []);

  return { items, list, isSubscribed, toggle, clear };
}