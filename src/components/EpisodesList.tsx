import React, { useMemo } from "react";
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

interface EpisodesListProps {
  subjectId: number;
}

const EpisodesList: React.FC<EpisodesListProps> = ({ subjectId }) => {
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
                <div
                  key={episode.id}
                  className="relative overflow-hidden rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-blue-300 dark:hover:border-blue-500 transition-colors cursor-pointer p-4 flex flex-col"
                >
                  <div className="relative flex flex-col h-full">
                    {/* 集数与日期 */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="inline-flex items-center justify-center w-10 h-10 bg-blue-500 text-white text-sm font-bold rounded-lg">
                        {episode.ep?.toFixed(0)}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {episode.airdate}
                      </span>
                    </div>

                    {/* 剧集标题 */}
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

                    {/* 元信息 */}
                    <div className="pt-3 mt-auto border-t border-gray-100 dark:border-slate-700 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                        <Eye className="w-3 h-3" aria-hidden="true" />
                        <span>
                          {episode.comment_str ||
                            episode.comment.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                        <Clock className="w-3 h-3" aria-hidden="true" />
                        <span>
                          {episode.duration_display ||
                            episode.duration ||
                            "N/A"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
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
    </div>
  );
};

export default React.memo(EpisodesList);
