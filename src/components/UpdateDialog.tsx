import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  checkUpdate,
  downloadAndInstall,
  restartApp,
  type UpdateInfo,
} from "@/lib/api";
import { Rocket, Sparkles } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

interface UpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  updateInfo: UpdateInfo | null;
}

type UpdateStatus = "idle" | "downloading" | "installing" | "done";

export function UpdateDialog({
  open,
  onOpenChange,
  updateInfo,
}: UpdateDialogProps) {
  const [status, setStatus] = useState<UpdateStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [totalSize, setTotalSize] = useState(0);

  const handleUpdate = useCallback(async () => {
    setStatus("downloading");
    setProgress(0);
    setTotalSize(0);

    try {
      await downloadAndInstall(({ total, percent }) => {
        setTotalSize(total);
        setProgress(percent);
      });

      setStatus("done");
      toast.success("更新下载完成，即将重启应用...");
      window.setTimeout(() => {
        restartApp();
      }, 1500);
    } catch (error) {
      console.error("Update failed:", error);
      setStatus("idle");
      toast.error("更新失败，请稍后重试");
    }
  }, []);

  const handleLater = useCallback(() => {
    onOpenChange(false);
    setStatus("idle");
  }, [onOpenChange]);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const isProcessing = status === "downloading" || status === "installing";
  const isDone = status === "done";

  return (
    <AlertDialog
      open={open}
      onOpenChange={isProcessing ? undefined : onOpenChange}
    >
      <AlertDialogContent className="sm:max-w-[425px]">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5 text-primary" />
            发现新版本
          </AlertDialogTitle>
        </AlertDialogHeader>

        <div className="grid gap-4 py-2">
          {updateInfo && (
            <>
              <div className="flex items-center justify-between space-x-2 rounded-lg border p-3 bg-muted/30">
                <div className="flex flex-col items-start gap-1">
                  <span className="text-xs text-muted-foreground">
                    当前版本
                  </span>
                  <Badge variant="outline" className="font-mono">
                    v{updateInfo.currentVersion}
                  </Badge>
                </div>
                <div className="flex items-center text-muted-foreground">→</div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-xs text-muted-foreground">
                    最新版本
                  </span>
                  <Badge className="font-mono bg-primary/10 text-primary hover:bg-primary/20 border-primary/20">
                    v{updateInfo.latestVersion}
                  </Badge>
                </div>
              </div>

              {updateInfo.body && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Rocket className="h-4 w-4 text-muted-foreground" />
                    更新内容
                  </div>
                  <ScrollArea className="h-[120px] w-full rounded-md border p-3 text-sm bg-muted/10">
                    <div className="whitespace-pre-wrap text-muted-foreground leading-relaxed">
                      {updateInfo.body}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {status === "downloading" && (
                <div className="space-y-2 animate-in fade-in zoom-in duration-300">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>正在下载更新...</span>
                    <span className="tabular-nums">
                      {progress}% · {totalSize > 0 && formatSize(totalSize)}
                    </span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              )}

              {status === "done" && (
                <div className="flex items-center justify-center gap-2 rounded-lg bg-green-500/10 py-3 text-sm text-green-600 dark:text-green-400 animate-in fade-in slide-in-from-bottom-2">
                  <Sparkles className="h-4 w-4" />
                  更新完成，准备重启
                </div>
              )}
            </>
          )}
        </div>

        <AlertDialogFooter>
          {!isDone && (
            <>
              <Button
                variant="outline"
                onClick={handleLater}
                disabled={isProcessing}
                className="cursor-pointer"
              >
                稍后提醒
              </Button>
              <Button
                onClick={handleUpdate}
                disabled={isProcessing}
                className="cursor-pointer min-w-[100px]"
              >
                {isProcessing ? (
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    下载中
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Rocket className="h-4 w-4" />
                    立即更新
                  </div>
                )}
              </Button>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// Hook for automatic update checking on app start
export function useAutoUpdateCheck() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [showDialog, setShowDialog] = useState(false);

  const checkForUpdates = useCallback(async () => {
    try {
      const result = await checkUpdate();
      if (result?.available) {
        setUpdateInfo(result);
        setShowDialog(true);
      }
    } catch (error) {
      // 静默失败，不影响应用启动
      console.error("Auto-update check failed:", error);
    }
  }, []);

  return {
    updateInfo,
    showDialog,
    setShowDialog,
    checkForUpdates,
  };
}
