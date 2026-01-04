import { useCallback, useMemo, useState } from "react";
import { useDownloadAction } from "../hooks/use-download-action";
import { useDownloadList } from "../hooks/use-download-list";
import { useEpisodeResources } from "../hooks/use-episode-resources";
import type { Episode } from "../types/gen/bangumi";
import type {
  MikanResourceItem,
  MikanResourcesResponse,
} from "../types/gen/mikan";
import { ResourceGroupList } from "./ResourceGroupList";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { ScrollArea } from "./ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Spinner } from "./ui/spinner";

export function ResourceDialog({
  open,
  onOpenChange,
  episode,
  resources,
  isSingle,
  loading,
  subjectId,
  subjectCover,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  episode: Episode | null;
  resources?: MikanResourcesResponse | null;
  isSingle?: boolean;
  loading?: boolean;
  subjectId?: number;
  subjectCover?: string;
}) {
  const { matched, mapped } = useEpisodeResources(
    resources ?? null,
    episode ?? null,
    isSingle,
  );

  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  const [resFilter, setResFilter] = useState<number | null>(null);
  const [sublangFilter, setSublangFilter] = useState<string | null>(null);

  const { handleDownload, isDownloading } = useDownloadAction({
    subjectId,
    subjectCover,
    episode,
  });

  // 包装函数，传递 episode_range 给 handleDownload
  const handleDownloadWithResource = useCallback(
    (url: string, title: string, item: MikanResourceItem) => {
      handleDownload(url, title, item.episode_range || null);
    },
    [handleDownload],
  );

  const { isConnected, isCheckingConnection } = useDownloadList();

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
                    className="cursor-pointer"
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
                <ResourceGroupList
                  groups={filteredGrouped}
                  onDownload={handleDownloadWithResource}
                  isConnected={isConnected}
                  isCheckingConnection={isCheckingConnection}
                  isDownloading={isDownloading}
                />
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
