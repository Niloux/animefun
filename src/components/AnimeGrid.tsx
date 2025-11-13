import React, { useState } from "react";
import { Anime } from "../types/bangumi";
import { getRatingColorClass } from "../lib/utils";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../constants/routes";

interface AnimeGridProps {
  items: Anime[];
}

// 单个番剧卡片组件
const AnimeCard = React.memo(({ anime, index }: { anime: Anime; index: number }) => {
  const navigate = useNavigate();
  const [isImageLoaded, setIsImageLoaded] = useState(false);

  const handleAnimeClick = () => {
    navigate(ROUTES.ANIME_DETAIL.replace(":id", anime.id.toString()));
  };

  return (
    <div
      className="bg-card rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-all duration-300 border border-border/60 flex flex-col hover:translate-y-[-2px] active:translate-y-0 cursor-pointer hover:border-primary/50"
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
        {/* 低分辨率占位图 (使用 grid 尺寸，专为网格视图优化) */}
        <img
          src={anime.images.grid}
          alt={anime.name}
          width={160}  // 设置与主图相同的宽高比，避免布局偏移
          height={240} // h-60 = 240px
          className={`w-full h-60 object-cover transition-opacity duration-300 ${
            isImageLoaded ? "opacity-0" : "opacity-100 blur-sm"
          }`}
        />
        {/* 主图 (使用 large 尺寸，保证清晰度) */}
        <img
          src={anime.images.large}
          alt={anime.name}
          width={160}  // 设置明确的宽高，避免布局偏移
          height={240}
          className={`absolute inset-0 w-full h-60 object-cover transition-opacity duration-300 hover:scale-105 ${
            isImageLoaded ? "opacity-100" : "opacity-0"
          }`}
          loading={index < 8 ? "eager" : "lazy"} // 前8个卡片使用eager加载，提升初始加载体验
          onLoad={() => setIsImageLoaded(true)}
          // 图片加载失败时回退到占位图状态
          onError={() => setIsImageLoaded(false)}
        />
        {/* 评分标签 */}
        {anime.rating && anime.rating.score !== 0 && (
          <div
            className={`absolute top-3 right-3 ${getRatingColorClass(anime.rating.score)} text-white rounded-full px-2 py-0.5 text-xs font-medium shadow-md`}
          >
            {anime.rating.score.toFixed(1)}
          </div>
        )}
      </div>
      {/* 番剧信息 */}
      <div className="p-4 flex flex-col grow justify-between">
        <h3 className="text-sm font-semibold line-clamp-1 transition-colors duration-200 hover:text-primary">
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

// 番剧卡片网格组件
export const AnimeGrid = React.memo(({ items }: AnimeGridProps) => {
  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 lg:gap-5 transition-opacity duration-300 opacity-100"
    >
      {items.map((anime, index) => (
        <AnimeCard key={anime.id} anime={anime} index={index} />
      ))}
    </div>
  );
});

AnimeGrid.displayName = "AnimeGrid";