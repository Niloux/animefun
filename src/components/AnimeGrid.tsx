import { Anime } from "../types/bangumi";
import { getRatingColorClass } from "../lib/utils";

interface AnimeGridProps {
  items: Anime[];
}

export const AnimeGrid = ({ items }: AnimeGridProps) => {
  return (
    // 番剧卡片网格
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 lg:gap-5">
      {items.map((anime) => (
        <div
          key={anime.id}
          className="bg-card rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300 border border-border/60 flex flex-col"
        >
          <div className="relative">
            <img
              src={anime.images.large}
              alt={anime.name}
              className="w-full h-60 object-cover"
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
            <h3 className="text-sm font-semibold line-clamp-1">
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
};
