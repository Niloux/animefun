import { FC } from "react";
import { DownloadItem } from "@/types/gen/downloader";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, Trash2 } from "lucide-react";
import { formatBytes, formatDuration, cn } from "@/lib/utils";

interface DownloadCardProps {
  item: DownloadItem;
  onPause: () => void;
  onResume: () => void;
  onDelete: () => void;
}

export const DownloadCard: FC<DownloadCardProps> = ({
  item,
  onPause,
  onResume,
  onDelete,
}) => {
  const isPaused =
    item.status.toLowerCase().includes("paused") ||
    item.status.toLowerCase().includes("stop");
  const isError = item.status.toLowerCase().includes("error");
  const isCompleted = item.progress >= 100;

  let statusColor = "bg-primary border-transparent";
  if (isPaused)
    statusColor = "bg-yellow-500 hover:bg-yellow-600 border-transparent";
  if (isError)
    statusColor = "bg-destructive hover:bg-destructive border-transparent";
  if (isCompleted)
    statusColor = "bg-green-500 hover:bg-green-600 border-transparent";

  return (
    <Card className="w-full overflow-hidden transition-shadow hover:shadow-sm">
      <CardContent className="p-0">
        <div className="flex h-32">
          {/* Cover Image */}
          <div className="w-24 shrink-0 bg-muted relative">
            {item.cover ? (
              <img
                src={item.cover}
                alt={item.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground bg-secondary">
                No Cover
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 p-3 flex flex-col justify-between overflow-hidden">
            <div>
              <div className="flex justify-between items-start gap-2">
                <h3
                  className="font-semibold text-sm line-clamp-2 leading-tight text-foreground/90"
                  title={item.title}
                >
                  {item.title}
                </h3>
                {item.episode && (
                  <Badge
                    variant="secondary"
                    className="shrink-0 text-[10px] px-1 h-5"
                  >
                    EP {item.episode}
                  </Badge>
                )}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Badge
                  className={cn(
                    "text-[10px] px-1.5 h-4 shadow-none text-white",
                    statusColor
                  )}
                >
                  {item.status}
                </Badge>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground font-mono">
                <span>{formatBytes(item.dlspeed)}/s</span>
                <span>{formatDuration(item.eta)}</span>
              </div>
              <Progress value={item.progress} className="h-1.5" />
            </div>
          </div>

          {/* Actions */}
          <div className="w-10 flex flex-col items-center justify-center border-l bg-muted/20 gap-2">
            {isPaused ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onResume}
                title="Resume"
              >
                <Play className="w-4 h-4 text-green-600" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onPause}
                title="Pause"
              >
                <Pause className="w-4 h-4 text-yellow-600" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-destructive/10"
              onClick={onDelete}
              title="Delete"
            >
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
