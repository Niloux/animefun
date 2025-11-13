import { ArrowLeft, Calendar, Star, Award } from "lucide-react";
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
        <div className="mb-6">
          <div className="h-8 w-40 bg-gray-200 rounded animate-pulse"></div>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-1">
            <div className="h-96 bg-gray-200 rounded-xl animate-pulse"></div>
          </div>
          <div className="md:col-span-2 space-y-4">
            <div className="h-10 w-2/3 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-6 w-1/3 bg-gray-200 rounded animate-pulse"></div>
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-4 w-full bg-gray-200 rounded animate-pulse"></div>
              ))}
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
      {/* 返回按钮 */}
      <div className="p-4 md:p-8">
        <div className="mb-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            返回
          </button>
        </div>

        {/* 主内容区 */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* 左侧海报 */}
          <div className="md:col-span-1">
            <div className="relative rounded-xl overflow-hidden shadow-2xl border border-gray-200 dark:border-gray-700">
              <img
                src={anime.images.large}
                alt={anime.name}
                className="w-full aspect-[2/3] object-cover"
              />
              {/* 评分标签 */}
              {anime.rating && (
                <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-500 flex items-center justify-center shadow-lg border-4 border-white">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-white">
                      {anime.rating.score.toFixed(1)}
                    </p>
                    <p className="text-xs text-yellow-100 font-semibold">评分</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 右侧详情 */}
          <div className="md:col-span-2 space-y-6">
            {/* 标题区域 */}
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-2 text-gray-900 dark:text-white">
                {anime.name_cn || anime.name}
              </h1>
              <p className="text-muted-foreground">{anime.name}</p>
            </div>

            {/* 基本信息 */}
            <div className="flex items-center gap-6 flex-wrap">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                <span className="text-xl font-semibold text-gray-900 dark:text-white">
                  {anime.rating?.score.toFixed(1)}
                </span>
              </div>
              <div className="w-1 h-6 bg-gray-300 dark:bg-gray-700"></div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="w-5 h-5" />
                <span>{anime.date || anime.air_date}</span>
              </div>
              <div className="w-1 h-6 bg-gray-300 dark:bg-gray-700"></div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Award className="w-5 h-5" />
                <span>{anime.platform}</span>
              </div>
            </div>

            {/* 收藏状态统计 */}
            {anime.collection && (
              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div>
                  <p className="text-muted-foreground text-sm mb-1">想看</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {anime.collection.wish.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm mb-1">在看</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {anime.collection.doing.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm mb-1">已看</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {anime.collection.collect.toLocaleString()}
                  </p>
                </div>
              </div>
            )}

            {/* 简介 */}
            <div className="bg-white dark:bg-gray-900 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">剧情介绍</h2>
              <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
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
        </div>

        {/* 制作信息 */}
        <div className="mt-8 max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-2"></div>
            <div className="space-y-4">
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