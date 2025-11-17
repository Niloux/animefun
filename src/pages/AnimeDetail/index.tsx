import { Calendar, Award } from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import EpisodesList from "../../components/EpisodesList";
import { useAnimeDetail } from "../../hooks/use-anime-detail";

const AnimeDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { anime, loading } = useAnimeDetail(id);

  if (loading) {
    return (
      <div className="p-8">
        {/* 海报和基本信息区加载 */}
        <div className="flex flex-col md:flex-row gap-8 md:gap-10 mb-8">
          {/* 左侧海报 */}
          <div className="w-44 md:w-72 shrink-0">
            <div className="aspect-2/3 bg-gray-200 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 animate-pulse"></div>
          </div>

          {/* 右侧标题和基本信息 */}
          <div className="flex-1 space-y-6">
            <div className="space-y-2">
              <div className="h-10 w-3/4 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-4 w-1/2 bg-gray-200 rounded animate-pulse"></div>
            </div>
            <div className="flex items-center gap-6 flex-wrap text-sm pt-2">
              <div className="h-4 w-16 bg-gray-200 rounded animate-pulse"></div>
              <div className="w-1 h-4 bg-gray-300 dark:bg-gray-600 animate-pulse"></div>
              <div className="h-4 w-16 bg-gray-200 rounded animate-pulse"></div>
            </div>
            <div className="grid grid-cols-3 gap-8 pt-4 border-t border-gray-200">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="text-center">
                  <div className="h-3 w-12 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-7 w-20 bg-gray-200 rounded animate-pulse mt-2"></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 主要内容区 - 两列布局 */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* 左侧 - 剧情介绍和标签 */}
          <div className="md:col-span-2 space-y-6">
            {/* 简介 */}
            <div className="bg-white rounded-lg p-6 shadow-md border border-gray-200 space-y-4">
              <div className="h-6 w-24 bg-gray-200 rounded animate-pulse"></div>
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-4 w-full bg-gray-200 rounded animate-pulse"></div>
                ))}
              </div>
            </div>

            {/* 标签 */}
            <div className="bg-white rounded-lg p-6 shadow-md border border-gray-200 space-y-4">
              <div className="h-6 w-16 bg-gray-200 rounded animate-pulse"></div>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-7 w-24 bg-gray-200 rounded-full animate-pulse"></div>
                ))}
              </div>
            </div>
          </div>

          {/* 右侧 - 制作信息 */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg p-6 shadow-md border border-gray-200 space-y-4">
              <div className="h-6 w-32 bg-gray-200 rounded animate-pulse"></div>
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex justify-between items-start pb-3 border-b border-gray-200 last:border-b-0 last:pb-0">
                    <div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div>
                    <div className="h-4 w-32 bg-gray-200 rounded animate-pulse"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!anime) {
    return (
      <div className="p-8">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">未找到该动画</h2>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            返回上一页
          </button>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen">
      <div className="p-4 md:p-8">
        {/* 海报和基本信息区 */}
        <div className="flex flex-col md:flex-row gap-8 md:gap-10 mb-8">
          {/* 左侧海报 */}
          <div className="w-44 md:w-72 shrink-0">
            <div className="relative rounded-lg overflow-hidden shadow-2xl border border-gray-200 dark:border-gray-700">
              <img
                src={anime.images.large}
                alt={anime.name}
                className="w-full aspect-2/3 object-cover"
              />
            </div>
          </div>

          {/* 右侧标题和基本信息 */}
          <div className="flex-1 space-y-6">
            {/* 标题区域 */}
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2">
                {anime.name_cn || anime.name}
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">{anime.name}</p>
            </div>

            {/* 基本信息 */}
            <div className="flex items-center gap-6 flex-wrap text-sm pt-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-500" />
                <span className="text-gray-700 dark:text-gray-300">
                  {anime.date || anime.air_date}
                </span>
              </div>
              <div className="w-1 h-4 bg-gray-300 dark:bg-gray-600"></div>
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-gray-500" />
                <span className="text-gray-700 dark:text-gray-300">{anime.platform}</span>
              </div>
            </div>

            {/* 收藏状态统计 */}
            {anime.collection && (
              <div className="grid grid-cols-3 gap-8 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="text-center">
                  <p className="text-gray-600 dark:text-gray-400 text-xs mb-2">想看</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {anime.collection.wish.toLocaleString()}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-gray-600 dark:text-gray-400 text-xs mb-2">在看</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {anime.collection.doing.toLocaleString()}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-gray-600 dark:text-gray-400 text-xs mb-2">已看</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {anime.collection.collect.toLocaleString()}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 主要内容区 - 两列布局 */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* 左侧 - 剧情介绍和标签 */}
          <div className="md:col-span-2 space-y-6">
            {/* 简介 */}
            <div className="bg-white dark:bg-gray-900 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">剧情介绍</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                {anime.summary || "暂无简介"}
              </p>
            </div>

            {/* 标签 */}
            <div className="bg-white dark:bg-gray-900 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">标签</h2>
              <div className="flex flex-wrap gap-2">
                {(anime.tags?.slice(0, 15) || []).map((tag: { name: string }, idx: number) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors cursor-pointer"
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* 右侧 - 制作信息 */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-900 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-500" />
                制作信息
              </h2>
              <div className="space-y-3">
                {anime.infobox?.map((info: { key: string; value: unknown }, idx: number) => (
                  <div
                    key={idx}
                    className="flex justify-between items-start pb-3 border-b border-gray-200 dark:border-gray-700 last:border-b-0 last:pb-0"
                  >
                    <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                      {info.key}:
                    </span>
                    <span className="text-sm text-gray-900 dark:text-white font-semibold text-right">
                      {/* 由于我们已经在数据处理阶段提取了字符串value，这里可以安全转换 */}
                      {String(info.value || '')}
                    </span>
                  </div>
                )) || (
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    暂无制作信息
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 剧集列表 */}
        <div className="mt-8">
          <EpisodesList
            subjectId={anime.id}
            totalEpisodes={anime.eps || anime.total_episodes || 0}
          />
        </div>
      </div>
    </div>
  );
};

export default AnimeDetailPage;