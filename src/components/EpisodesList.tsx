import React, { useMemo } from 'react';
import { Eye, Clock } from 'lucide-react';
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from "@/components/ui/carousel";
import { useEpisodes } from '../hooks/use-episodes';

interface EpisodesListProps {
  subjectId: number;
}

const EpisodesList: React.FC<EpisodesListProps> = ({ subjectId }) => {
  const { episodes, loading } = useEpisodes(subjectId);

  const LIMIT = 6;
  const mainEpisodes = episodes;
  const pages = useMemo(() => {
    const list: typeof mainEpisodes[] = [];
    for (let i = 0; i < mainEpisodes.length; i += LIMIT) {
      list.push(mainEpisodes.slice(i, i + LIMIT));
    }
    return list;
  }, [mainEpisodes]);

  // 直接在映射中生成页面（无需创建中间数组）

  return (
    <div className="w-full bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">剧集列表</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">共 {mainEpisodes.length} 话</p>
      </div>

      {/* Episodes Carousel */}
      {loading ? (
        <div className="text-center py-12">
          <div className="w-12 h-12 border-4 border-gray-300 dark:border-slate-700 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">加载中...</p>
        </div>
      ) : mainEpisodes.length > 0 ? (
        <div className="p-6">
          <Carousel className="w-full">
            <CarouselContent className="-ml-4">
              {pages.map((page, pageIndex) => (
                <CarouselItem key={pageIndex} className="pl-4 basis-full">
                  <div className="grid grid-cols-3 gap-4">
                    {page.map((episode) => (
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
                              <span className="text-xs text-gray-500 dark:text-gray-400">{episode.airdate}</span>
                            </div>

                            {/* 剧集标题 */}
                            <div className="flex-1 mb-auto">
                              <p className="font-semibold text-gray-900 dark:text-white text-sm leading-tight">
                                {episode.name_cn || episode.name}
                              </p>
                              {episode.name !== episode.name_cn && (
                                <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mt-1">{episode.name}</p>
                              )}
                            </div>

                            {/* 元信息 */}
                            <div className="pt-3 mt-auto border-t border-gray-100 dark:border-slate-700 flex items-center justify-between text-xs">
                              <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                                <Eye className="w-3 h-3" aria-hidden="true" />
                                <span>{episode.comment_str || episode.comment.toLocaleString()}</span>
                              </div>
                              <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                                <Clock className="w-3 h-3" aria-hidden="true" />
                                <span>{episode.duration_display || episode.duration || 'N/A'}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                    ))}
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>

            {/* 导航按钮 */}
            <CarouselPrevious className="absolute -left-4 top-1/2 -translate-y-1/2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors" />
            <CarouselNext className="absolute -right-4 top-1/2 -translate-y-1/2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors" />
          </Carousel>
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-600 dark:text-gray-400">暂无剧集信息</p>
        </div>
      )}
    </div>
  );
};

export default React.memo(EpisodesList);
