import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import {
  checkUpdate,
  downloadAndInstall,
  restartApp,
  type UpdateInfo,
} from "@/lib/api";
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
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>发现新版本</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              {updateInfo && (
                <>
                  <p>
                    当前版本：
                    <span className="font-medium">
                      {updateInfo.currentVersion}
                    </span>
                    <br />
                    最新版本：
                    <span className="font-medium text-primary">
                      {updateInfo.latestVersion}
                    </span>
                  </p>
                  {updateInfo.body && (
                    <div className="max-h-40 overflow-y-auto rounded-md bg-muted/50 p-3 text-sm">
                      <p className="mb-2 font-medium">更新内容：</p>
                      <div className="whitespace-pre-wrap text-muted-foreground">
                        {updateInfo.body}
                      </div>
                    </div>
                  )}
                  {status === "downloading" && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>下载中...</span>
                        <span className="text-muted-foreground">
                          {progress}% · {totalSize > 0 && formatSize(totalSize)}
                        </span>
                      </div>
                      <Progress value={progress} />
                    </div>
                  )}
                  {status === "done" && (
                    <p className="text-center text-sm text-green-600 dark:text-green-400">
                      更新完成，正在重启...
                    </p>
                  )}
                </>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {!isDone && (
            <>
              <Button
                className="cursor-pointer"
                variant="outline"
                onClick={handleLater}
                disabled={isProcessing}
              >
                稍后提醒
              </Button>
              <Button
                className="cursor-pointer"
                onClick={handleUpdate}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Spinner className="mr-2 h-4 w-4" />
                    下载中
                  </>
                ) : (
                  "立即更新"
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
