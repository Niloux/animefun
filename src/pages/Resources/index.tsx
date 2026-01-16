import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDownloadList } from "@/hooks/use-download-list";
import { useFadeIn } from "@/hooks/use-fade-in";
import { openDownloadFolder } from "@/lib/api";
import { DownloadItem } from "@/types/gen/downloader";
import {
  CheckCircle2,
  Download,
  HardDriveDownload,
  ListFilter,
  Loader2,
  WifiOff,
} from "lucide-react";
import { FC, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DownloadCard } from "../../components/DownloadCard";
import { navigateToAnimeDetail } from "@/lib/utils";

const ResourcesPage: FC = () => {
  const navigate = useNavigate();
  const {
    items,
    loading,
    isConnected,
    isCheckingConnection,
    refresh,
    handlePause,
    handleResume,
    handleDelete,
    handlePlayVideo,
  } = useDownloadList();
  const [itemToDelete, setItemToDelete] = useState<DownloadItem | null>(null);

  // 内容淡入动画：连接成功后触发
  const isContentVisible = useFadeIn(isConnected);

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    const success = await handleDelete(itemToDelete.hash);
    if (success) {
      setItemToDelete(null);
    }
  };

  const handleCoverClick = (subjectId: number) => {
    navigateToAnimeDetail(navigate, subjectId);
  };

  const handleOpenFolder = async (item: DownloadItem) => {
    if (item.save_path) {
      try {
        await openDownloadFolder(item.save_path);
      } catch (error) {
        console.error("Failed to open folder:", error);
      }
    }
  };

  const handlePlay = async (item: DownloadItem) => {
    if (item.progress >= 100) {
      try {
        await handlePlayVideo(item.hash);
      } catch {
        // 如果播放失败，降级到打开文件夹
        if (item.save_path) {
          await openDownloadFolder(item.save_path);
        }
      }
    }
  };

  const downloadingItems = useMemo(
    () => items.filter((item) => item.progress < 100),
    [items]
  );
  const downloadedItems = useMemo(
    () => items.filter((item) => item.progress >= 100),
    [items]
  );

  // 计算总下载速度
  const totalSpeed = useMemo(() => {
    return items.reduce((acc, item) => acc + Number(item.dlspeed), 0);
  }, [items]);

  const formatTotalSpeed = (speed: number) => {
    if (speed === 0) return "0 B/s";
    const k = 1024;
    const sizes = ["B/s", "KB/s", "MB/s", "GB/s"];
    const i = Math.floor(Math.log(speed) / Math.log(k));
    return parseFloat((speed / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  if (!isConnected) {
    return (
      <div className="flex h-[80vh] w-full flex-col items-center justify-center gap-6 text-center animate-in fade-in-50 duration-500">
        <div className="rounded-full bg-muted/50 p-8">
          <WifiOff className="size-12 text-muted-foreground/50" />
        </div>
        <div className="space-y-2 max-w-sm">
          <h3 className="text-xl font-semibold tracking-tight">
            无法连接到下载服务
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            请检查 qBittorrent 是否已启动且配置正确。
            <br />
            需要保持后台服务运行以管理下载任务。
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => refresh()}
            className="gap-2 cursor-pointer"
            disabled={isCheckingConnection}
          >
            {isCheckingConnection ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                连接中...
              </>
            ) : (
              "重试连接"
            )}
          </Button>
          <Button
            onClick={() => navigate("/settings")}
            className="cursor-pointer"
          >
            前往配置
          </Button>
        </div>
      </div>
    );
  }

  const renderList = (
    list: DownloadItem[],
    emptyMsg: string,
    icon?: React.ReactNode
  ) => {
    if (loading && items.length === 0) {
      return (
        <div className="flex h-64 flex-col items-center justify-center gap-4 text-muted-foreground">
          <Spinner className="size-8 text-primary/50" />
          <span className="text-sm font-medium">正在同步下载任务...</span>
        </div>
      );
    }

    if (list.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-[50vh] text-muted-foreground animate-in fade-in-50 duration-500">
          <div className="mb-4 rounded-full bg-muted/50 p-6">
            {icon || <HardDriveDownload className="size-10 opacity-40" />}
          </div>
          <p className="text-sm font-medium">{emptyMsg}</p>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-3 pb-20">
        {list.map((item) => (
          <DownloadCard
            key={item.hash}
            item={item}
            onPause={() => handlePause(item.hash)}
            onResume={() => handleResume(item.hash)}
            onDelete={() => setItemToDelete(item)}
            onOpenFolder={() => handleOpenFolder(item)}
            onCoverClick={() => handleCoverClick(item.subject_id)}
            onPlay={() => handlePlay(item)}
          />
        ))}
      </div>
    );
  };

  return (
    <>
      <div
        className={`container mx-auto w-full py-0 space-y-4 transition-opacity duration-300 ${
          isContentVisible ? "opacity-100" : "opacity-0"
        }`}
      >
        <Tabs defaultValue="downloading" className="w-full">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
            <TabsList className="grid w-full max-w-xs md:max-w-md grid-cols-3 bg-muted/50 p-1 rounded-xl">
              <TabsTrigger
                value="downloading"
                className="gap-2 cursor-pointer rounded-lg data-[state=active]:shadow-sm"
              >
                <Download className="size-4" />
                下载中
                <Badge
                  variant="secondary"
                  className="ml-1 h-5 min-w-[1.25rem] px-1.5 text-xs bg-background/50"
                >
                  {downloadingItems.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger
                value="downloaded"
                className="gap-2 cursor-pointer rounded-lg data-[state=active]:shadow-sm"
              >
                <CheckCircle2 className="size-4" />
                已完成
                <Badge
                  variant="secondary"
                  className="ml-1 h-5 min-w-[1.25rem] px-1.5 text-xs bg-background/50"
                >
                  {downloadedItems.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger
                value="all"
                className="gap-2 cursor-pointer rounded-lg data-[state=active]:shadow-sm"
              >
                <ListFilter className="size-4" />
                全部
                <Badge
                  variant="secondary"
                  className="ml-1 h-5 min-w-[1.25rem] px-1.5 text-xs bg-background/50"
                >
                  {items.length}
                </Badge>
              </TabsTrigger>
            </TabsList>

            {totalSpeed > 0 && (
              <div className="hidden sm:flex items-center gap-2 rounded-lg border bg-card shadow-sm px-3 py-1.5">
                <div className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary"></span>
                </div>
                <span className="text-sm font-medium tabular-nums">
                  {formatTotalSpeed(totalSpeed)}
                </span>
              </div>
            )}
          </div>

          <div className="min-h-[60vh]">
            <TabsContent value="downloading" className="mt-0 outline-none">
              {renderList(
                downloadingItems,
                "暂无进行中的下载任务",
                <Download className="size-10 opacity-40" />
              )}
            </TabsContent>
            <TabsContent value="downloaded" className="mt-0 outline-none">
              {renderList(
                downloadedItems,
                "暂无已完成的资源",
                <CheckCircle2 className="size-10 opacity-40" />
              )}
            </TabsContent>
            <TabsContent value="all" className="mt-0 outline-none">
              {renderList(items, "暂无任何资源记录")}
            </TabsContent>
          </div>
        </Tabs>
      </div>

      <AlertDialog
        open={!!itemToDelete}
        onOpenChange={(open) => !open && setItemToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除任务？</AlertDialogTitle>
            <AlertDialogDescription>
              您确定要删除此下载任务吗？此操作将同时删除已下载的文件，且无法恢复。
              <div className="mt-4 rounded-md bg-muted p-3 text-sm font-medium text-foreground">
                {itemToDelete?.title}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive hover:bg-destructive/90 cursor-pointer"
            >
              删除任务及文件
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ResourcesPage;
