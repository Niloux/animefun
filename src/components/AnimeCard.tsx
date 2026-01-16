import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCachedImage } from "../hooks/use-cached-image";
import { ensureHttps, getRatingColorClass, navigateToAnimeDetail } from "../lib/utils";
import { Anime, CalendarItem } from "../types/gen/bangumi";
import { AspectRatio } from "./ui/aspect-ratio";
import { Badge } from "./ui/badge";
import { Skeleton } from "./ui/skeleton";

interface AnimeCardProps {
  anime: Anime | CalendarItem;
  index: number;
}

// 单个番剧卡片组件
// Note: React.memo removed - index prop changes on re-render make memo ineffective
export const AnimeCard = ({ anime, index }: AnimeCardProps) => {
  const navigate = useNavigate();
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const rawImgSrc = ensureHttps(
    anime.images?.large ||
    anime.images?.common ||
    anime.images?.medium ||
    anime.images?.small ||
    "https://lain.bgm.tv/img/no_icon_subject.png"
  );
  const { src: cachedSrc } = useCachedImage(rawImgSrc);

  const handleAnimeClick = () => {
    navigateToAnimeDetail(navigate, anime.id);
  };

  return (
    <div
      className="bg-card rounded-xl shadow-sm overflow-hidden hover:shadow-xl transition-all duration-300 border border-border/60 flex flex-col hover:translate-y-[-4px] active:translate-y-0 cursor-pointer hover:border-primary/50 group"
      onClick={handleAnimeClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleAnimeClick();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className="relative overflow-hidden">
        <AspectRatio ratio={3 / 4}>
          <img
            src={cachedSrc ?? rawImgSrc}
            alt={anime.name}
            className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-105 ${
              isImageLoaded ? "opacity-100" : "opacity-0"
            }`}
            loading={index < 8 ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={index < 8 ? "high" : "auto"}
            onLoad={() => setIsImageLoaded(true)}
            onError={() => setIsImageLoaded(false)}
          />
        </AspectRatio>
        {!isImageLoaded && <Skeleton className="absolute inset-0" />}
        {/* 评分标签 */}
        {anime.rating && anime.rating.score !== 0 && (
          <Badge
            className={`absolute top-3 right-3 ${getRatingColorClass(
              anime.rating.score,
            )} text-white rounded-full text-xs font-medium shadow-md border-white/20 backdrop-blur-sm`}
          >
            {anime.rating.score.toFixed(1)}
          </Badge>
        )}
      </div>
      {/* 番剧信息 */}
      <div className="p-4 flex flex-col grow justify-between">
        <h3 className="text-sm font-semibold line-clamp-1 hover:text-primary">
          {anime.name_cn || anime.name}
        </h3>
        {("air_date" in anime ? anime.air_date : anime.date) && (
          <div className="text-xs text-muted-foreground mt-2">
            {"air_date" in anime ? anime.air_date : anime.date}
          </div>
        )}
      </div>
    </div>
  );
};
