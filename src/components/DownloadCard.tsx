import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatBytes, formatDuration } from "@/lib/utils";
import { DownloadItem } from "@/types/gen/downloader";
import { Film, Folder, Pause, Play, Trash2 } from "lucide-react";
import { memo } from "react";

interface DownloadCardProps {
  item: DownloadItem;
  onPause: () => void;
  onResume: () => void;
  onDelete: () => void;
  onOpenFolder?: () => void;
  onCoverClick?: () => void;
  onPlay?: () => void;
}

export const DownloadCard = memo<DownloadCardProps>(
  ({ item, onPause, onResume, onDelete, onOpenFolder, onCoverClick, onPlay }) => {
    const isPaused =
      item.status.toLowerCase().includes("paused") ||
      item.status.toLowerCase().includes("stop");
    const isCompleted = item.progress >= 100;

    return (
      <Card className="py-2 group overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm transition-all hover:border-primary/30 hover:shadow-lg">
        <div className="flex items-center gap-4 px-2">
          {/* Thumbnail */}
          <div
            className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-border/50 bg-muted/30 shadow-sm md:h-24 md:w-24 cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
            onClick={onCoverClick}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onCoverClick?.();
              }
            }}
            role="button"
            tabIndex={onCoverClick ? 0 : undefined}
          >
            {item.cover ? (
              <AspectRatio ratio={3 / 4}>
                <img
                  src={item.cover}
                  alt={item.title}
                  loading="lazy"
                  className="h-full w-full object-fill transition-transform duration-300 group-hover:scale-105"
                />
              </AspectRatio>
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-secondary text-xs text-muted-foreground">
                No Cover
              </div>
            )}
            <div className="absolute right-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
              1080P
            </div>
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1 space-y-3">
            {/* Title and Actions */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-semibold leading-tight text-foreground">
                  {item.title}
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {item.episode_range
                    ? `${item.episode_range} 合集`
                    : item.episode
                      ? `第${item.episode}话`
                      : "未知剧集"}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {/* 下载中: 暂停/恢复按钮 | 下载完成: 播放按钮 */}
                {isCompleted ? (
                  onPlay && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground transition-colors hover:text-green-500 cursor-pointer"
                      onClick={onPlay}
                      title="播放视频"
                    >
                      <Film className="h-4 w-4" />
                    </Button>
                  )
                ) : (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
                    onClick={isPaused ? onResume : onPause}
                  >
                    {isPaused ? (
                      <Play className="h-4 w-4" />
                    ) : (
                      <Pause className="h-4 w-4" />
                    )}
                  </Button>
                )}
                {isCompleted && item.save_path && onOpenFolder && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
                    onClick={onOpenFolder}
                    title="打开文件夹"
                  >
                    <Folder className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-muted-foreground transition-colors hover:text-destructive cursor-pointer"
                  onClick={onDelete}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <Progress value={item.progress} className="h-1.5" />

              {/* Stats */}
              <div className="flex items-center justify-between text-xs min-w-0">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="font-semibold text-primary shrink-0">
                    {item.progress.toFixed(1)}%
                  </span>
                  {!isCompleted && (
                    <span className="text-muted-foreground truncate">
                      <span className="font-medium text-foreground">
                        {formatBytes(item.dlspeed)}/s
                      </span>
                    </span>
                  )}
                </div>
                {!isCompleted && item.eta > 0 && (
                  <div className="flex items-center gap-2 text-muted-foreground shrink-0">
                    <span>剩余 {formatDuration(item.eta)}</span>
                  </div>
                )}
                {isCompleted && (
                  <div className="flex items-center gap-2 text-muted-foreground shrink-0">
                    <span>已完成</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>
    );
  },
  (prev, next) => {
    return (
      prev.item.hash === next.item.hash &&
      prev.item.progress === next.item.progress &&
      prev.item.status === next.item.status &&
      prev.item.dlspeed === next.item.dlspeed &&
      prev.item.eta === next.item.eta
    );
  },
);

DownloadCard.displayName = "DownloadCard";
