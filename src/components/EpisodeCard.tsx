import { Eye, Clock } from "lucide-react";
import type { Episode as BEpisode } from "../types/bangumi";

export function EpisodeCard({
  episode,
  onOpen,
}: {
  episode: BEpisode;
  onOpen: (id: number) => void;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-blue-300 dark:hover:border-blue-500 transition-colors cursor-pointer p-4 flex flex-col h-40"
      onClick={() => onOpen(episode.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen(episode.id);
      }}
    >
      <div className="relative flex flex-col h-full">
        <div className="flex items-center justify-between mb-3">
          <span className="inline-flex items-center justify-center w-10 h-10 bg-blue-500 text-white text-sm font-bold rounded-lg">
            {episode.sort.toFixed(0)}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {episode.airdate}
          </span>
        </div>
        <div className="flex-1 mb-auto">
          <p className="font-semibold text-gray-900 dark:text-white text-sm leading-tight">
            {episode.name_cn || episode.name}
          </p>
          {episode.name !== episode.name_cn && (
            <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mt-1">
              {episode.name}
            </p>
          )}
        </div>
        <div className="pt-3 mt-auto border-t border-gray-100 dark:border-slate-700 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
            <Eye className="w-3 h-3" aria-hidden="true" />
            <span>
              {episode.comment_str || episode.comment.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
            <Clock className="w-3 h-3" aria-hidden="true" />
            <span>{episode.duration_display || episode.duration || "N/A"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
