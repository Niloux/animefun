import { Eye, Clock } from "lucide-react";
import type { Episode } from "../types/gen/bangumi";

export function EpisodeCard({
  episode,
  onOpen,
}: {
  episode: Episode;
  onOpen: (id: number) => void;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-primary/50 hover:shadow-md transition-all duration-300 cursor-pointer p-4 flex flex-col h-40 group hover:-translate-y-1"
      onClick={() => onOpen(episode.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen(episode.id);
      }}
    >
      <div className="relative flex flex-col h-full">
        <div className="flex items-center justify-between mb-3">
          <span className="inline-flex items-center justify-center w-10 h-10 bg-primary/10 text-primary text-sm font-bold rounded-lg group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
            {episode.sort.toFixed(0)}
          </span>
          <span className="text-xs text-muted-foreground">
            {episode.airdate}
          </span>
        </div>
        <div className="flex-1 mb-auto">
          <p className="font-semibold text-foreground text-sm leading-tight line-clamp-1 group-hover:text-primary transition-colors">
            {episode.name_cn || episode.name}
          </p>
          {episode.name !== episode.name_cn && (
            <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
              {episode.name}
            </p>
          )}
        </div>
        <div className="pt-3 mt-auto border-t border-border flex items-center justify-between text-xs">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Eye className="w-3 h-3" aria-hidden="true" />
            <span>{episode.comment.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="w-3 h-3" aria-hidden="true" />
            <span>{episode.duration || "N/A"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
