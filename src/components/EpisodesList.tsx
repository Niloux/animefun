import React, { useMemo, useState } from "react";
import { Eye, Clock, ChevronDown } from "lucide-react";
import { Button } from "./ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from "./ui/pagination";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { useEpisodes } from "../hooks/use-episodes";
import { visiblePages } from "../lib/pagination";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from "./ui/drawer";
import { ScrollArea } from "./ui/scroll-area";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "./ui/select";
import { Badge } from "./ui/badge";
import type { MikanResourcesResponse } from "../types/gen/mikan";
import type { Episode as BEpisode } from "../types/bangumi";
import { useEpisodeResources } from "../hooks/use-episode-resources";

function EpisodeCard({
  episode,
  onOpen,
}: {
  episode: BEpisode;
  onOpen: (id: number) => void;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-blue-300 dark:hover:border-blue-500 transition-colors cursor-pointer p-4 flex flex-col h-40"
      onClick={() => onOpen(episode.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen(episode.id);
      }}
    >
      <div className="relative flex flex-col h-full">
        <div className="flex items-center justify-between mb-3">
          <span className="inline-flex items-center justify-center w-10 h-10 bg-blue-500 text-white text-sm font-bold rounded-lg">
            {episode.sort.toFixed(0)}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {episode.airdate}
          </span>
        </div>
        <div className="flex-1 mb-auto">
          <p className="font-semibold text-gray-900 dark:text-white text-sm leading-tight">
            {episode.name_cn || episode.name}
          </p>
          {episode.name !== episode.name_cn && (
            <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mt-1">
              {episode.name}
            </p>
          )}
        </div>
        <div className="pt-3 mt-auto border-t border-gray-100 dark:border-slate-700 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
            <Eye className="w-3 h-3" aria-hidden="true" />
            <span>
              {episode.comment_str || episode.comment.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
            <Clock className="w-3 h-3" aria-hidden="true" />
            <span>{episode.duration_display || episode.duration || "N/A"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResourceDrawer({
  open,
  onOpenChange,
  episode,
  resources,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  episode: BEpisode | null;
  resources?: MikanResourcesResponse | null;
}) {
  const { epNo, matched, mapped } = useEpisodeResources(
    resources ?? null,
    episode ?? null
  );

  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  const [resFilter, setResFilter] = useState<number | null>(null);
  const [sublangFilter, setSublangFilter] = useState<string | null>(null);

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
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <div className="mx-auto w-full max-w-2xl">
          <DrawerHeader>
            <DrawerTitle>
              {episode
                ? `第 ${epNo} 话 ${episode.name_cn || episode.name}`
                : ""}
            </DrawerTitle>
          </DrawerHeader>
          <div className="p-4 pt-0">
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

                {(groupFilter || resFilter || sublangFilter) && (
                  <div className="flex flex-wrap items-center gap-1">
                    {groupFilter && (
                      <Badge variant="secondary">{groupFilter}</Badge>
                    )}
                    {resFilter && (
                      <Badge variant="secondary">{resFilter}p</Badge>
                    )}
                    {sublangFilter && (
                      <Badge variant="secondary">{sublangFilter}</Badge>
                    )}
                  </div>
                )}
              </div>
            )}
            {resources && !mapped ? (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                未命中
              </div>
            ) : matched.length === 0 ? (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                暂无资源
              </div>
            ) : (
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
                            <div className="flex flex-wrap gap-2 text-xs">
                              {it.page_url && (
                                <a
                                  href={it.page_url}
                                  className="text-blue-600 dark:text-blue-400 hover:underline"
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  页面
                                </a>
                              )}
                              {it.torrent_url && (
                                <a
                                  href={it.torrent_url}
                                  className="text-blue-600 dark:text-blue-400 hover:underline"
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  种子
                                </a>
                              )}
                              {it.magnet && (
                                <button
                                  className="text-blue-600 dark:text-blue-400 hover:underline"
                                  onClick={() =>
                                    navigator.clipboard?.writeText(
                                      it.magnet as string
                                    )
                                  }
                                >
                                  复制磁力
                                </button>
                              )}
                              {it.pub_date && (
                                <span className="text-muted-foreground">
                                  {it.pub_date}
                                </span>
                              )}
                              {typeof it.resolution === "number" && (
                                <span className="text-muted-foreground">
                                  {it.resolution}p
                                </span>
                              )}
                              {it.subtitle_lang && (
                                <span className="text-muted-foreground">
                                  {it.subtitle_lang}
                                </span>
                              )}
                              {it.subtitle_type && (
                                <span className="text-muted-foreground">
                                  {it.subtitle_type}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline">关闭</Button>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

interface EpisodesListProps {
  subjectId: number;
  resources?: MikanResourcesResponse | null;
}

const EpisodesList: React.FC<EpisodesListProps> = ({
  subjectId,
  resources,
}) => {
  const {
    episodes,
    loading,
    error,
    reload,
    currentPage,
    totalPages,
    totalEpisodes,
    jumpToPage,
  } = useEpisodes(subjectId);

  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selectedEpisode = useMemo(
    () => episodes.find((e) => e.id === selectedId) || null,
    [episodes, selectedId]
  );

  // 发生错误时重新加载
  const handleReload = () => {
    reload();
  };
  const pages = useMemo(
    () => visiblePages(Math.max(1, totalPages), currentPage + 1),
    [totalPages, currentPage]
  );

  // 生成快速跳页的页码项
  const pageItems = useMemo(() => {
    const pages = [];
    for (let i = 0; i < totalPages; i++) {
      pages.push(
        <DropdownMenuItem
          key={i}
          onSelect={() => jumpToPage(i)}
          className={`cursor-pointer ${currentPage === i ? "bg-primary/10" : ""}`}
        >
          <div className="flex items-center justify-between w-full">
            <span>第 {i + 1} 页</span>
            {currentPage === i && (
              <span className="ml-2 w-2 h-2 rounded-full bg-primary"></span>
            )}
          </div>
        </DropdownMenuItem>
      );
    }
    return pages;
  }, [totalPages, currentPage, jumpToPage]);

  return (
    <div className="w-full bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
      {/* 头部 */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              剧集列表
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              共 {totalEpisodes} 话
            </p>
          </div>

          {/* 快速跳页下拉菜单 */}
          {totalPages > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1"
                  disabled={loading}
                >
                  第 {currentPage + 1} / {totalPages} 页
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-56 max-h-80 overflow-y-auto"
                align="end"
              >
                {pageItems}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* 错误信息 */}
      {error && (
        <div className="px-6 py-4 text-red-600 dark:text-red-400">
          <p>{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleReload}
            className="mt-2"
          >
            重试
          </Button>
        </div>
      )}

      {/* 剧集网格 */}
      <div className="p-6">
        {loading && episodes.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 border-4 border-gray-300 dark:border-slate-700 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">加载中...</p>
          </div>
        ) : episodes.length > 0 ? (
          <>
            <div className="grid grid-cols-3 gap-4 mb-4">
              {episodes.map((episode) => (
                <EpisodeCard
                  key={episode.id}
                  episode={episode as BEpisode}
                  onOpen={(id) => {
                    setSelectedId(id);
                    setOpen(true);
                  }}
                />
              ))}
              {Array.from({ length: Math.max(0, 6 - episodes.length) }).map(
                (_, idx) => (
                  <div
                    key={`ph-${idx}`}
                    className="invisible pointer-events-none relative overflow-hidden rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 h-40"
                  />
                )
              )}
            </div>

            {totalPages > 1 && (
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => jumpToPage(Math.max(0, currentPage - 1))}
                      aria-disabled={currentPage === 0 || loading}
                    />
                  </PaginationItem>
                  {pages.map((p, idx) =>
                    p === "ellipsis" ? (
                      <PaginationItem key={`e-${idx}`}>
                        <PaginationEllipsis />
                      </PaginationItem>
                    ) : (
                      <PaginationItem key={p}>
                        <PaginationLink
                          isActive={p === currentPage + 1}
                          onClick={() => jumpToPage(p - 1)}
                          aria-disabled={loading}
                        >
                          {p}
                        </PaginationLink>
                      </PaginationItem>
                    )
                  )}
                  <PaginationItem>
                    <PaginationNext
                      onClick={() => {
                        if (currentPage + 1 < totalPages) {
                          jumpToPage(currentPage + 1);
                        }
                      }}
                      aria-disabled={currentPage + 1 >= totalPages || loading}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </>
        ) : !loading && episodes.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-400">暂无剧集信息</p>
          </div>
        ) : null}
      </div>

      <ResourceDrawer
        open={open}
        onOpenChange={setOpen}
        episode={selectedEpisode as BEpisode | null}
        resources={resources ?? null}
      />
    </div>
  );
};

export default React.memo(EpisodesList);
