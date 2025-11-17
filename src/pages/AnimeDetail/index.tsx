/* global ResizeObserver */
import { Calendar, Tv2Icon, Film } from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { useRef, useState, useEffect } from "react";
import { Button } from "../../components/ui/button";
import { Separator } from "../../components/ui/separator";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "../../components/ui/resizable";
import EpisodesList from "../../components/EpisodesList";
import { useAnimeDetail } from "../../hooks/use-anime-detail";

const AnimeDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { anime, loading } = useAnimeDetail(id);
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const [leftPanelHeight, setLeftPanelHeight] = useState<number>(0);

  // 同步左右面板高度
  useEffect(() => {
    const updateHeight = () => {
      if (leftPanelRef.current) {
        setLeftPanelHeight(leftPanelRef.current.offsetHeight);
      }
    };

    // 初始加载时更新高度
    updateHeight();

    // 使用 ResizeObserver 监听左侧面板尺寸变化（包括面板调整、窗口resize等所有情况）
    const observer = new ResizeObserver(updateHeight);
    if (leftPanelRef.current) {
      observer.observe(leftPanelRef.current);
    }

    // 组件卸载时清理监听
    return () => observer.disconnect();
  }, [anime]);

  if (!anime || loading) {
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
      <div className="p-0">
        {/* 海报和基本信息区 */}
        <div className="flex flex-col md:flex-row gap-8 md:gap-10 mb-8">
          {/* 左侧海报 */}
          <div className="w-36 md:w-56 shrink-0">
            <div className="relative rounded-lg overflow-hidden shadow-2xl border border-gray-200 dark:border-gray-700">
              <img src={anime.images.large} alt={anime.name} />
            </div>
          </div>

          {/* 右侧标题和基本信息 */}
          <div className="flex-1 flex flex-col gap-6">
            {/* 标题区域 */}
            <div>
              <h1 className="text-3xl md:text-[2.25rem] font-bold text-gray-900 dark:text-white mb-2 leading-tight">
                {anime.name_cn || anime.name}
              </h1>
              <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 font-medium">
                {anime.name}
              </p>
            </div>

            {/* 核心信息区 */}
            <div className="flex h-5 items-center space-x-4 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                <span>{anime.date || anime.air_date}</span>
              </div>
              <Separator orientation="vertical" />
              <div className="flex items-center gap-2">
                <Tv2Icon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                <span>{anime.platform || "未知"}</span>
              </div>
              <Separator orientation="vertical" />
              <div className="flex items-center gap-2">
                <Film className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                <span>{anime.eps || anime.total_episodes || 0} 话</span>
              </div>
            </div>

            {/* Meta Tags */}
            {anime.meta_tags && anime.meta_tags.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {anime.meta_tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors cursor-pointer"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* 订阅和状态统计区 - 基本内容区域底部 */}
            <div className="flex flex-col md:flex-row gap-4 items-stretch pt-2 mt-auto">
              {/* 订阅按钮 */}
              <Button
                variant="default"
                size="lg"
                className="flex-1 md:flex-none"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                  />
                </svg>
                订阅番剧
              </Button>
            </div>
          </div>
        </div>

        {/* 主要内容区 - 可调整大小的两列布局 */}
        <ResizablePanelGroup direction="horizontal" className="gap-6">
          {/* 左侧 - 剧情介绍和标签 */}
          <ResizablePanel defaultSize={66} minSize={50}>
            <div ref={leftPanelRef} className="space-y-6">
              {/* 简介 */}
              <div className="bg-white dark:bg-gray-900 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  剧情介绍
                </h2>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                  {anime.summary || "暂无简介"}
                </p>
              </div>

              {/* 标签 */}
              <div className="bg-white dark:bg-gray-900 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  标签
                </h2>
                <div className="flex flex-wrap gap-2">
                  {(anime.tags?.slice(0, 15) || []).map(
                    (tag: { name: string }, idx: number) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors cursor-pointer"
                      >
                        {tag.name}
                      </span>
                    )
                  )}
                </div>
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* 右侧 - 制作信息 */}
          <ResizablePanel defaultSize={34} minSize={25} className="space-y-6">
            <div
              className="bg-white dark:bg-gray-900 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700 overflow-y-auto"
              style={{ maxHeight: `${leftPanelHeight}px` }}
            >
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-500" />
                制作信息
              </h2>
              <div className="space-y-3">
                {anime.infobox?.map(
                  (info: { key: string; value: unknown }, idx: number) => (
                    <div
                      key={idx}
                      className="flex justify-between items-start pb-3 border-b border-gray-200 dark:border-gray-700 last:border-b-0 last:pb-0"
                    >
                      <span className="text-sm text-gray-600 dark:text-gray-400 font-medium whitespace-nowrap">
                        {info.key}:
                      </span>
                      <span className="text-sm text-gray-900 dark:text-white font-semibold text-right">
                        {/* 由于我们已经在数据处理阶段提取了字符串value，这里可以安全转换 */}
                        {String(info.value || "")}
                      </span>
                    </div>
                  )
                ) || (
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    暂无制作信息
                  </div>
                )}
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>

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
