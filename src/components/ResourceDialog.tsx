import { useMemo, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { ScrollArea } from "./ui/scroll-area";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "./ui/select";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Spinner } from "./ui/spinner";
import type { MikanResourcesResponse } from "../types/gen/mikan";
import type { Episode as BEpisode } from "../types/bangumi";
import { useEpisodeResources } from "../hooks/use-episode-resources";

export function ResourceDialog({
  open,
  onOpenChange,
  episode,
  resources,
  isSingle,
  loading,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  episode: BEpisode | null;
  resources?: MikanResourcesResponse | null;
  isSingle?: boolean;
  loading?: boolean;
}) {
  const { matched, mapped } = useEpisodeResources(
    resources ?? null,
    episode ?? null,
    isSingle
  );

  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  const [resFilter, setResFilter] = useState<number | null>(null);
  const [sublangFilter, setSublangFilter] = useState<string | null>(null);

  const formatSize = (v?: number | bigint | null) => {
    if (v == null) return null;
    const n = typeof v === "bigint" ? Number(v) : v;
    if (!Number.isFinite(n) || n <= 0) return null;
    const units = ["B", "KB", "MB", "GB", "TB"];
    let i = 0;
    let s = n;
    while (s >= 1024 && i < units.length - 1) {
      s /= 1024;
      i++;
    }
    const val = s < 10 ? s.toFixed(1) : Math.round(s).toString();
    return `${val} ${units[i]}`;
  };

  const groupOptions = useMemo(() => {
    const s = new Set<string>();
    for (const it of matched) s.add(it.group || "未知字幕组");
    return Array.from(s.values()).sort((a, b) => a.localeCompare(b));
  }, [matched]);

  const resOptions = useMemo(() => {
    const s = new Set<number>();
    for (const it of matched) {
      if (typeof it.resolution === "number") s.add(it.resolution);
    }
    return Array.from(s.values()).sort((a, b) => b - a);
  }, [matched]);

  const sublangOptions = useMemo(() => {
    const s = new Set<string>();
    for (const it of matched) {
      if (it.subtitle_lang) s.add(it.subtitle_lang);
    }
    return Array.from(s.values()).sort((a, b) => a.localeCompare(b));
  }, [matched]);

  const filteredGrouped = useMemo(() => {
    const list = matched.filter((it) => {
      const g = it.group || "未知字幕组";
      if (groupFilter && g !== groupFilter) return false;
      if (resFilter && it.resolution !== resFilter) return false;
      if (sublangFilter && it.subtitle_lang !== sublangFilter) return false;
      return true;
    });
    const m = new Map<string, typeof list>();
    for (const it of list) {
      const g = it.group || "未知字幕组";
      const arr = m.get(g) || [];
      arr.push(it);
      m.set(g, arr);
    }
    return Array.from(m.entries()).map(([group, items]) => ({ group, items }));
  }, [matched, groupFilter, resFilter, sublangFilter]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl" showCloseButton={false}>
        <div className="mx-auto w-full max-w-2xl">
          <DialogHeader className="py-4 gap-1">
            <DialogTitle>
              {episode ? `${episode.name_cn || episode.name}` : ""}
            </DialogTitle>
            <DialogDescription>共 {matched.length} 条资源</DialogDescription>
          </DialogHeader>
          <div className="pt-0">
            {matched.length > 0 && (
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Select
                  value={groupFilter ?? "__all__"}
                  onValueChange={(v) =>
                    setGroupFilter(v === "__all__" ? null : v)
                  }
                >
                  <SelectTrigger size="sm">
                    <SelectValue placeholder="字幕组" />
                  </SelectTrigger>
                  <SelectContent align="start">
                    <SelectItem value="__all__">全部字幕组</SelectItem>
                    {groupOptions.map((g) => (
                      <SelectItem key={g} value={g}>
                        {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={resFilter != null ? String(resFilter) : "__all__"}
                  onValueChange={(v) =>
                    setResFilter(v === "__all__" ? null : Number(v))
                  }
                >
                  <SelectTrigger size="sm">
                    <SelectValue placeholder="分辨率" />
                  </SelectTrigger>
                  <SelectContent align="start">
                    <SelectItem value="__all__">全部分辨率</SelectItem>
                    {resOptions.map((r) => (
                      <SelectItem key={r} value={String(r)}>
                        {r}p
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={sublangFilter ?? "__all__"}
                  onValueChange={(v) =>
                    setSublangFilter(v === "__all__" ? null : v)
                  }
                >
                  <SelectTrigger size="sm">
                    <SelectValue placeholder="字幕语言" />
                  </SelectTrigger>
                  <SelectContent align="start">
                    <SelectItem value="__all__">全部字幕语言</SelectItem>
                    {sublangOptions.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {(groupFilter || resFilter || sublangFilter) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setGroupFilter(null);
                      setResFilter(null);
                      setSublangFilter(null);
                    }}
                  >
                    清除筛选
                  </Button>
                )}
              </div>
            )}
            {loading ? (
              <div className="py-8 flex items-center justify-center gap-2 text-gray-600 dark:text-gray-400">
                <Spinner className="size-5" />
                资源加载中
              </div>
            ) : matched.length > 0 ? (
              <ScrollArea className="h-[50vh]">
                <div className="space-y-4">
                  {filteredGrouped.map((g) => (
                    <div key={g.group} className="border rounded-md">
                      <div className="px-3 py-2 font-semibold text-sm">
                        {g.group}
                      </div>
                      <div className="divide-y">
                        {g.items.map((it, idx) => (
                          <div key={idx} className="p-3 space-y-2">
                            <div className="text-sm font-medium">
                              {it.title}
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex flex-wrap items-center gap-2">
                                {typeof it.resolution === "number" && (
                                  <Badge
                                    variant="secondary"
                                    className="bg-chart-1 text-primary-foreground"
                                  >
                                    {it.resolution}p
                                  </Badge>
                                )}
                                {it.subtitle_lang && (
                                  <Badge
                                    variant="secondary"
                                    className="bg-chart-2 text-primary-foreground"
                                  >
                                    {it.subtitle_lang}
                                  </Badge>
                                )}
                                {formatSize(it.size_bytes) && (
                                  <Badge
                                    variant="secondary"
                                    className="bg-chart-3 text-primary-foreground"
                                  >
                                    {formatSize(it.size_bytes) as string}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {it.page_url && (
                                  <Button
                                    className="cursor-pointer"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openUrl(it.page_url!)}
                                  >
                                    页面
                                  </Button>
                                )}
                                {it.torrent_url && (
                                  <Button
                                    className="cursor-pointer"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openUrl(it.torrent_url!)}
                                  >
                                    种子
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : resources && !mapped ? (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                未命中
              </div>
            ) : (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                暂无资源
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
