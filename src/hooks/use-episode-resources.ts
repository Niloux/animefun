import { useMemo } from "react";
import type { MikanResourcesResponse, MikanResourceItem } from "../types/gen/mikan";
import type { Episode } from "../types/bangumi";

function epNoOf(e: Episode | null): number | null {
  if (!e) return null;
  return e.sort ?? e.ep ?? null;
}

function matchRange(range?: string, no?: number): boolean {
  if (!range || typeof no !== "number") return false;
  const m = range.match(/(\d{1,3})\s*-\s*(\d{1,3})/);
  if (m) {
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    return no >= a && no <= b;
  }
  const n = range.match(/(\d{1,3})/);
  if (n) {
    const v = parseInt(n[1], 10);
    return no === v;
  }
  return false;
}

export function useEpisodeResources(resources?: MikanResourcesResponse | null, episode?: Episode | null) {
  const epNo = useMemo(() => epNoOf(episode ?? null), [episode]);

  const matched = useMemo<MikanResourceItem[]>(() => {
    if (!resources?.mapped || !resources.items || epNo == null) return [];
    return resources.items.filter((it) => {
      if (typeof it.episode === "number") return it.episode === epNo;
      return matchRange(it.episode_range, epNo);
    });
  }, [resources, epNo]);

  const grouped = useMemo(() => {
    const m = new Map<string, MikanResourceItem[]>();
    for (const it of matched) {
      const g = it.group || "未知字幕组";
      const arr = m.get(g) || [];
      arr.push(it);
      m.set(g, arr);
    }
    return Array.from(m.entries()).map(([group, items]) => ({ group, items }));
  }, [matched]);

  const mapped = !!(resources && resources.mapped);

  return { epNo, matched, grouped, mapped };
}
