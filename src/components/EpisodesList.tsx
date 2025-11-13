import React, { useState, useEffect } from 'react';
import { Eye, Clock } from 'lucide-react';
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from "@/components/ui/carousel";
import { getEpisodes } from '../lib/api';
import { Episode } from '../types/bangumi';

interface EpisodesListProps {
  subjectId: number;
  totalEpisodes?: number | string;
}

function EpisodesList({ subjectId, totalEpisodes: _totalEpisodes }: EpisodesListProps) {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(false);

  const LIMIT = 6; // 每页6集（3列 × 2行）

  const loadEpisodes = React.useCallback(async () => {
    setLoading(true);
    try {
      // 获取所有剧集
      const result = await getEpisodes(subjectId, undefined, 100, 0);
      setEpisodes(result.data || []);
    } catch (error) {
      console.error("Failed to load episodes:", error);
      // 失败时使用mock数据
      const mockEpisodes: Episode[] = Array.from({ length: 12 }, (_, i) => ({
        id: i + 1,
        type: 0,
        name: `Episode ${i + 1}`,
        name_cn: `第${i + 1}话`,
        sort: i + 1,
        ep: i + 1,
        airdate: `2008-1${i < 9 ? '0' : ''}${i + 2}`,
        comment: Math.floor(Math.random() * 1000),
        duration: '24:00',
        desc: `这是第${i + 1}话的描述`,
        disc: 1,
      }));
      setEpisodes(mockEpisodes);
    } finally {
      setLoading(false);
    }
  }, [subjectId]);

  useEffect(() => {
    loadEpisodes();
  }, [subjectId, loadEpisodes]);

  // 根据sort和disc对剧集进行排序
  const sortedEpisodes = [...episodes].sort((a, b) => {
    if (a.disc !== b.disc) {
      return a.disc - b.disc;
    }
    return a.sort - b.sort;
  });

  // 过滤掉预告片等非正片内容
  const mainEpisodes = sortedEpisodes.filter(
    (episode) => episode.type === 0 && episode.ep !== null
  );

  const pages = [];
  for (let i = 0; i < mainEpisodes.length; i += LIMIT) {
    pages.push(mainEpisodes.slice(i, i + LIMIT));
  }

  return (
    <div className="w-full bg-white dark:bg-slate-900 rounded-lg shadow-md border border-gray-200 dark:border-slate-700">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-slate-800 dark:to-slate-700 px-6 py-4 border-b border-gray-200 dark:border-slate-700">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">剧集列表</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">共 {mainEpisodes.length} 话 · 左右滑动切换范围</p>
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
                  <div className="grid grid-cols-3 gap-4 min-h-64">
                    {page.map((episode) => (
                      <div
                        key={episode.id}
                        className="group relative overflow-hidden rounded-lg border border-gray-200 dark:border-slate-700 bg-gradient-to-br from-white to-gray-50 dark:from-slate-800 dark:to-slate-900 hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-500 transition-all duration-300 cursor-pointer p-4 flex flex-col"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 to-blue-500/0 group-hover:from-blue-500/5 group-hover:to-blue-500/10 transition-all duration-300"></div>

                        <div className="relative flex flex-col h-full">
                          {/* Episode Number & Date */}
                          <div className="flex items-center justify-between mb-3">
                            <span className="inline-flex items-center justify-center w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 text-white text-sm font-bold rounded-lg shadow-md">
                              {episode.ep?.toFixed(0)}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{episode.airdate}</span>
                          </div>

                          {/* Episode Title */}
                          <div className="flex-1 mb-auto">
                            <p className="font-semibold text-gray-900 dark:text-white text-sm mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-tight">
                              {episode.name_cn || episode.name}
                            </p>
                            {episode.name !== episode.name_cn && (
                              <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">{episode.name}</p>
                            )}
                          </div>

                          {/* Meta Info */}
                          <div className="pt-3 mt-auto border-t border-gray-100 dark:border-slate-700 flex items-center justify-between">
                            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                              <Eye className="w-3 h-3" />
                              <span>{episode.comment.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                              <Clock className="w-3 h-3" />
                              <span>{episode.duration || 'N/A'}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>

            {/* Navigation Buttons */}
            <CarouselPrevious className="absolute -left-4 top-1/2 -translate-y-1/2 border-2 bg-white dark:bg-slate-900 hover:bg-blue-500 hover:text-white transition-all" />
            <CarouselNext className="absolute -right-4 top-1/2 -translate-y-1/2 border-2 bg-white dark:bg-slate-900 hover:bg-blue-500 hover:text-white transition-all" />
          </Carousel>
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-600 dark:text-gray-400">暂无剧集信息</p>
        </div>
      )}
    </div>
  );
}

export default EpisodesList;
