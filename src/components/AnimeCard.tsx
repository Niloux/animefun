import React, { useState } from "react";
import { Anime, CalendarItem } from "../types/bangumi";
import { getRatingColorClass } from "../lib/utils";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../constants/routes";
import { Badge } from "./ui/badge";
import { Skeleton } from "./ui/skeleton";
import { useCachedImage } from "../hooks/use-cached-image";

interface AnimeCardProps {
  anime: Anime | CalendarItem;
  index: number;
}

// 单个番剧卡片组件
export const AnimeCard = React.memo(({ anime, index }: AnimeCardProps) => {
  const navigate = useNavigate();
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const rawImgSrc =
    anime.images?.large ||
    anime.images?.common ||
    anime.images?.medium ||
    anime.images?.small ||
    "https://lain.bgm.tv/img/no_icon_subject.png";
  const { src: cachedSrc } = useCachedImage(rawImgSrc);

  const handleAnimeClick = () => {
    navigate(ROUTES.ANIME_DETAIL.replace(":id", anime.id.toString()));
  };

  return (
    <div
      className="bg-card rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-all duration-300 border border-border/60 flex flex-col hover:translate-y-[-6px] active:translate-y-0 cursor-pointer hover:border-primary/50"
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
        <img
          src={cachedSrc ?? rawImgSrc}
          alt={anime.name}
          width={160}
          height={240}
          className={`w-full h-60 object-cover transition-opacity duration-300 ${
            isImageLoaded ? "opacity-100" : "opacity-0"
          }`}
          loading={index < 8 ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={index < 8 ? "high" : "auto"}
          onLoad={() => setIsImageLoaded(true)}
          onError={() => setIsImageLoaded(false)}
        />
        {!isImageLoaded && (
          <Skeleton className="absolute inset-0 w-full h-60" />
        )}
        {/* 评分标签 */}
        {anime.rating && anime.rating.score !== 0 && (
          <Badge
            className={`absolute top-3 right-3 ${getRatingColorClass(anime.rating.score)} text-white rounded-full text-xs font-medium`}
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
        {anime.air_date && (
          <div className="text-xs text-muted-foreground mt-2">
            {anime.air_date}
          </div>
        )}
      </div>
    </div>
  );
});

AnimeCard.displayName = "AnimeCard";