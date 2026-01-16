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
                  className="flex items-center gap-1 cursor-pointer"
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
        {loading && data.length === 0 ? (
          <div className="text-center py-12 flex flex-col items-center gap-3">
            <Loader2 className="w-10 h-10 text-muted-foreground animate-spin" />
            <p className="text-muted-foreground text-sm">加载剧集信息...</p>
          </div>
        ) : data.length > 0 ? (
          <>
            <div className="grid grid-cols-3 gap-4 mb-4">
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
          </>
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
