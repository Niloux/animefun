import React from "react";
import { Anime } from "../types/bangumi";
import { getRatingColorClass } from "../lib/utils";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../constants/routes";

interface AnimeGridProps {
  items: Anime[];
}

export const AnimeGrid = React.memo(({ items }: AnimeGridProps) => {
  const navigate = useNavigate();

  const handleAnimeClick = (id: number) => {
    navigate(ROUTES.ANIME_DETAIL.replace(":id", id.toString()));
  };

  return (
    // 番剧卡片网格
    <div
      className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 lg:gap-5 transition-opacity duration-300 opacity-100"
    >
      {items.map((anime) => (
        <div
          key={anime.id}
          className="bg-card rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-all duration-300 border border-border/60 flex flex-col hover:translate-y-[-2px] active:translate-y-0 cursor-pointer hover:border-primary/50"
          onClick={() => handleAnimeClick(anime.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleAnimeClick(anime.id);
            }
          }}
          role="button"
          tabIndex={0}
        >
          <div className="relative overflow-hidden">
            <img
              src={anime.images.large}
              alt={anime.name}
              className="w-full h-60 object-cover transition-transform duration-300 hover:scale-105"
              loading="lazy"
            />
            {anime.rating && anime.rating.score !== 0 && (
              <div
                className={`absolute top-3 right-3 ${getRatingColorClass(anime.rating.score)} text-white rounded-full px-2 py-0.5 text-xs font-medium shadow-md`}
              >
                {anime.rating.score.toFixed(1)}
              </div>
            )}
          </div>
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
      ))}
    </div>
  );
});

AnimeGrid.displayName = "AnimeGrid";