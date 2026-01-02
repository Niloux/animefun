import React from "react";
import { Anime, CalendarItem } from "../types/gen/bangumi";
import { AnimeCard } from "./AnimeCard";

interface AnimeGridProps {
  items: Array<Anime | CalendarItem>;
}

// 番剧卡片网格组件
export const AnimeGrid = React.memo(({ items }: AnimeGridProps) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3 sm:gap-4 lg:gap-5 transition-opacity duration-300 opacity-100">
      {items.map((anime, index) => (
        <AnimeCard key={anime.id} anime={anime} index={index} />
      ))}
    </div>
  );
});

AnimeGrid.displayName = "AnimeGrid";
