import React, { useMemo, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { PaginationBar } from "./PaginationBar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { useEpisodes } from "../hooks/use-episodes";
import type { MikanResourcesResponse } from "../types/gen/mikan";
import { EpisodeCard } from "./EpisodeCard";
import { ResourceDialog } from "./ResourceDialog";

interface EpisodesListProps {
  subjectId: number;
  resources?: MikanResourcesResponse | null;
  resourcesLoading?: boolean;
  subjectTitle?: string;
  subjectCover?: string | null;
}

const EpisodesList: React.FC<EpisodesListProps> = ({
  subjectId,
  resources,
  resourcesLoading,
  subjectCover,
}) => {
  const {
    data,
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
    () => data.find((e) => e.id === selectedId) || null,
    [data, selectedId],
  );

  // 发生错误时重新加载
  const handleReload = () => {
    reload();
  };

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
        </DropdownMenuItem>,
      );
    }
    return pages;
  }, [totalPages, currentPage, jumpToPage]);

  return (
    <div className="w-full bg-card rounded-xl shadow-sm border border-border/60 overflow-hidden">
      {/* 头部 */}
      <div className="px-6 py-4 border-b border-border/60 bg-muted/20">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight">
              剧集列表
            </h2>
            <p className="text-sm text-muted-foreground mt-1 font-medium">
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
                  className="flex items-center gap-1 cursor-pointer hover:border-primary/50 transition-colors focus-visible:ring-2 focus-visible:ring-primary"
                  disabled={loading}
                >
                  第 {currentPage + 1} / {totalPages} 页
                  <ChevronDown className="w-3 h-3 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-56 max-h-80 overflow-y-auto animate-in zoom-in-95 duration-200"
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
        <div className="px-6 py-4 bg-destructive/5 text-destructive border-b border-destructive/10">
          <p className="font-medium">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleReload}
            className="mt-2 border-destructive/20 hover:bg-destructive/10 hover:text-destructive"
          >
            重试
          </Button>
        </div>
      )}

      {/* 剧集网格 */}
      <div className="p-6 bg-background/50">
        {loading && data.length === 0 ? (
          <div className="text-center py-12 flex flex-col items-center gap-3">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
            <p className="text-muted-foreground text-sm font-medium">正在加载剧集信息...</p>
          </div>
        ) : data.length > 0 ? (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both">
            <div className="grid grid-cols-3 gap-5 mb-6">
              {data.map((episode) => (
                <EpisodeCard
                  key={episode.id}
                  episode={episode}
                  onOpen={(id) => {
                    setSelectedId(id);
                    setOpen(true);
                  }}
                />
              ))}
              {Array.from({ length: Math.max(0, 6 - data.length) }).map(
                (_, idx) => (
                  <div
                    key={`ph-${idx}`}
                    className="invisible pointer-events-none relative overflow-hidden rounded-lg border border-border/40 bg-muted/10 p-4 h-40"
                  />
                ),
              )}
            </div>

            {totalPages > 1 && (
              <PaginationBar
                currentPage={currentPage + 1}
                totalPages={totalPages}
                onPageChange={(p) => jumpToPage(p - 1)}
              />
            )}
          </div>
        ) : !loading && data.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground bg-muted/10 rounded-lg border border-dashed border-border/50 mx-auto max-w-md">
            <p className="font-medium">暂无剧集信息</p>
            <p className="text-xs mt-1 opacity-70">稍后再来看看吧</p>
          </div>
        ) : null}
      </div>

      <ResourceDialog
        open={open}
        onOpenChange={setOpen}
        episode={selectedEpisode}
        resources={resources ?? null}
        isSingle={totalEpisodes === 1}
        loading={resourcesLoading}
        subjectId={subjectId}
        subjectCover={subjectCover || undefined}
      />
    </div>
  );
};

export default React.memo(EpisodesList);
