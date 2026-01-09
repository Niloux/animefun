import { useMemo } from "react";
import type { Episode } from "../types/gen/bangumi";
import type {
  MikanResourceItem,
  MikanResourcesResponse,
} from "../types/gen/mikan";

function getEpisodeCandidates(e: Episode | null): number[] {
  if (!e) return [];
  const nums = [];
  if (typeof e.sort === "number") nums.push(e.sort);
  if (typeof e.ep === "number" && e.sort != e.ep) nums.push(e.ep);
  return nums;
}

function matchRange(range?: string, candidates?: number[]): boolean {
  if (!range || !candidates || candidates.length === 0) return false;
  const m = range.match(/(\d{1,3})\s*-\s*(\d{1,3})/);
  if (m) {
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    return candidates.some((no) => no >= a && no <= b);
  }
  const n = range.match(/(\d{1,3})/);
  if (n) {
    const v = parseInt(n[1], 10);
    return candidates.includes(v);
  }
  return false;
}

export function useEpisodeResources(
  resources?: MikanResourcesResponse | null,
  episode?: Episode | null,
  isSingle?: boolean,
) {
  const epCandidates = useMemo(
    () => getEpisodeCandidates(episode ?? null),
    [episode],
  );

  const matched = useMemo<MikanResourceItem[]>(() => {
    if (!resources?.mapped || !resources.items) return [];
    if (resources.items.length === 0) return [];
    if (epCandidates.length === 0) return resources.items;
    const filtered = resources.items.filter((it) => {
      if (typeof it.episode === "number")
        return epCandidates.includes(it.episode);
      return matchRange(it.episode_range, epCandidates);
    });
    if (filtered.length === 0) {
      const hasEpisodeInfo = resources.items.some(
        (it) => typeof it.episode === "number" || !!it.episode_range,
      );
      if (!hasEpisodeInfo || isSingle) return resources.items;
    }
    return filtered;
  }, [resources, epCandidates, isSingle]);

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

  return { epNo: epCandidates[0] ?? null, matched, grouped, mapped };
}
