import { FC, useEffect, useState, useCallback } from "react";
import { DownloadItem } from "@/types/gen/downloader";
import {
  getTrackedDownloads,
  getLiveDownloadInfo,
  pauseDownload,
  resumeDownload,
  deleteDownload,
} from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Play, Pause, Trash2, HardDriveDownload } from "lucide-react";
import { formatBytes, formatDuration, cn } from "@/lib/utils";

const ResourcesDownloadingPage: FC = () => {
  const [items, setItems] = useState<DownloadItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchList = useCallback(async () => {
    try {
      const data = await getTrackedDownloads();
      setItems(data);
    } catch {
      toast.error("Failed to load downloads");
    } finally {
      setLoading(false);
    }
  }, []);

  const updateLiveInfo = useCallback(async () => {
    try {
      const liveInfos = await getLiveDownloadInfo();
      setItems((prev) => {
        return prev.map((item) => {
          const live = liveInfos.find((l) => l.hash === item.hash);
          if (live) {
            return {
              ...item,
              progress: live.progress * 100, // qbit returns 0-1
              dlspeed: live.dlspeed,
              eta: live.eta,
              status: live.state,
            };
          }
          return item;
        });
      });
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  useEffect(() => {
    const timer = window.setInterval(updateLiveInfo, 2000);
    return () => window.clearInterval(timer);
  }, [updateLiveInfo]);

  const handlePause = async (hash: string) => {
    try {
      await pauseDownload(hash);
      toast.success("Paused");
      updateLiveInfo();
    } catch {
      toast.error("Failed to pause");
    }
  };

  const handleResume = async (hash: string) => {
    try {
      await resumeDownload(hash);
      toast.success("Resumed");
      updateLiveInfo();
    } catch {
      toast.error("Failed to resume");
    }
  };

  const handleDelete = async (hash: string) => {
    if (!window.confirm("Delete this task and files?")) return;
    try {
      await deleteDownload(hash, true);
      toast.success("Deleted");
      setItems((prev) => prev.filter((i) => i.hash !== hash));
    } catch {
      toast.error("Failed to delete");
    }
  };

  if (loading && items.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">Loading...</div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-muted-foreground">
        <HardDriveDownload className="w-16 h-16 mb-4 opacity-20" />
        <p>No active downloads</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Downloads</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => (
          <DownloadCard
            key={item.hash}
            item={item}
            onPause={() => handlePause(item.hash)}
            onResume={() => handleResume(item.hash)}
            onDelete={() => handleDelete(item.hash)}
          />
        ))}
      </div>
    </div>
  );
};

const DownloadCard: FC<{
  item: DownloadItem;
  onPause: () => void;
  onResume: () => void;
  onDelete: () => void;
}> = ({ item, onPause, onResume, onDelete }) => {
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
    <Card className="overflow-hidden group">
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

export default ResourcesDownloadingPage;
