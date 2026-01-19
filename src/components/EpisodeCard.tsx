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
      className="relative overflow-hidden rounded-xl border border-border/60 bg-card hover:border-primary hover:shadow-lg transition-all duration-300 cursor-pointer p-4 flex flex-col h-40 group hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 outline-none"
      onClick={() => onOpen(episode.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen(episode.id);
      }}
    >
      <div className="relative flex flex-col h-full z-10">
        <div className="flex items-center justify-between mb-3">
          <span className="inline-flex items-center justify-center w-10 h-10 bg-primary/10 text-primary text-sm font-bold rounded-lg group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300 group-hover:scale-110 shadow-sm">
            {episode.sort.toFixed(0)}
          </span>
          <span className="text-xs text-muted-foreground font-medium bg-muted/50 px-2 py-1 rounded-md">
            {episode.airdate}
          </span>
        </div>
        <div className="flex-1 mb-auto">
          <p className="font-semibold text-foreground text-sm leading-tight line-clamp-1 group-hover:text-primary transition-colors duration-200">
            {episode.name_cn || episode.name}
          </p>
          {episode.name !== episode.name_cn && (
            <p className="text-xs text-muted-foreground line-clamp-1 mt-1 group-hover:text-muted-foreground/80">
              {episode.name}
            </p>
          )}
        </div>
        <div className="pt-3 mt-auto border-t border-border/50 group-hover:border-primary/10 transition-colors flex items-center justify-between text-xs">
          <div className="flex items-center gap-1 text-muted-foreground group-hover:text-primary/80 transition-colors">
            <Eye className="w-3 h-3" aria-hidden="true" />
            <span>{episode.comment.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground group-hover:text-primary/80 transition-colors">
            <Clock className="w-3 h-3" aria-hidden="true" />
            <span>{episode.duration || "N/A"}</span>
          </div>
        </div>
      </div>

      {/* Hover Background Pattern */}
      <div className="absolute inset-0 bg-linear-to-br from-primary/3 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
    </div>
  );
}
