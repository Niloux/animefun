import { Calendar, Tv2Icon, Film } from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { Button } from "../../components/ui/button";
import { Spinner } from "../../components/ui/spinner";
import { AspectRatio } from "../../components/ui/aspect-ratio";
import { Separator } from "../../components/ui/separator";
import { AnimeInfoBox } from "../../components/AnimeInfoBox";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "../../components/ui/resizable";
import EpisodesList from "../../components/EpisodesList";
import { useAnimeDetail } from "../../hooks/use-anime-detail";
import { useSubscriptions } from "../../hooks/use-subscriptions";
import { useCachedImage } from "../../hooks/use-cached-image";
import { Badge } from "../../components/ui/badge";
import { useSubjectStatus } from "../../hooks/use-subject-status";
import { SubscribeButton } from "../../components/SubscribeButton";
import { useMikanResources } from "../../hooks/use-mikan-resources";

const AnimeDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { anime, loading, error, reload } = useAnimeDetail(id);
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const [leftPanelHeight, setLeftPanelHeight] = useState<number>(0);
  const { isSubscribed, toggle } = useSubscriptions({ mode: "ids" });
  const rawImgSrc = anime
    ? anime.images?.large ||
      anime.images?.common ||
      anime.images?.medium ||
      anime.images?.small ||
      "https://lain.bgm.tv/img/no_icon_subject.png"
    : undefined;
  const { src: cachedSrc } = useCachedImage(rawImgSrc);
  const { status, loading: statusLoading } = useSubjectStatus(
    id ? Number(id) : undefined
  );
  const mikan = useMikanResources(id ? Number(id) : undefined);

  useEffect(() => {
    if (anime) {
      const nextTitle = anime.name_cn || anime.name;
      if (document.title !== nextTitle) {
        document.title = nextTitle;
      }
    }
  }, [anime]);

  useEffect(() => {
    const el = leftPanelRef.current;
    if (!el) return;
    const update = () => {
      const h = el.offsetHeight;
      if (h !== leftPanelHeight) setLeftPanelHeight(h);
    };
    update();
    const ro = new window.ResizeObserver(update);
    ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, [anime, leftPanelHeight]);

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex flex-col items-center gap-4">
          <Spinner className="size-10" />
          <div className="text-sm text-gray-600 dark:text-gray-400">
            加载详情中
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="text-center space-y-4">
          <h2 className="text-xl font-bold">加载失败</h2>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {error}
          </div>
          <div className="flex items-center justify-center gap-3">
            <Button onClick={() => reload()}>重试</Button>
            <Button variant="outline" onClick={() => navigate(-1)}>
              返回上一页
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!anime) {
    return (
      <div className="p-8">
        <div className="text-center space-y-4">
          <h2 className="text-xl font-bold">未找到该动画</h2>
          <Button onClick={() => navigate(-1)}>返回上一页</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="p-0">
        {/* 海报和基本信息区 */}
        <div className="flex flex-col md:flex-row gap-8 md:gap-10 mb-8 shrink-0">
          {/* 左侧海报 */}
          <div className="w-36 md:w-56 shrink-0">
            <div className="relative rounded-lg overflow-hidden shadow-2xl border border-gray-200 dark:border-gray-700">
              <AspectRatio ratio={2 / 3}>
                <img
                  src={(cachedSrc ?? rawImgSrc) as string}
                  alt={anime.name}
                  className="w-full h-full object-cover"
                  decoding="async"
                  fetchPriority="high"
                />
              </AspectRatio>
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
              <Separator orientation="vertical" />
              <div className="flex items-center gap-2">
                {statusLoading ? (
                  <Badge variant="outline">状态加载中</Badge>
                ) : status ? (
                  <Badge
                    variant={status.code === "Airing" ? "default" : "outline"}
                    title={status.reason}
                  >
                    {status.code === "Airing"
                      ? "连载中"
                      : status.code === "Finished"
                        ? "已完结"
                        : status.code === "OnHiatus"
                          ? "停更"
                          : status.code === "PreAir"
                            ? "未开播"
                            : "未知"}
                  </Badge>
                ) : (
                  <Badge variant="outline">状态不可用</Badge>
                )}
              </div>
            </div>

            {/* 元标签 */}
            {anime.meta_tags && anime.meta_tags.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {anime.meta_tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            <div className="flex flex-col md:flex-row gap-4 items-stretch pt-2 mt-auto">
              <SubscribeButton
                anime={anime}
                isSubscribed={isSubscribed(anime.id)}
                toggle={toggle}
                size="lg"
                className="flex-1 md:flex-none cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* 主要内容区 - 可调整大小的两列布局 */}
        <div className="flex-1 min-h-0">
          <ResizablePanelGroup direction="horizontal" className="gap-6 h-full">
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
                          className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
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
                className="overflow-y-auto"
                style={
                  leftPanelHeight
                    ? { height: `${leftPanelHeight}px` }
                    : undefined
                }
              >
                <AnimeInfoBox items={anime.infobox} />
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>

        {/* 剧集列表 */}
        <div className="mt-8">
          <EpisodesList subjectId={anime.id} resources={mikan.data ?? null} />
        </div>
      </div>
    </div>
  );
};

export default AnimeDetailPage;
