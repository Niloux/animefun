import { FC, useMemo, useState } from "react";
import { DownloadItem } from "@/types/gen/downloader";
import { HardDriveDownload, Download, CheckCircle2, ListFilter } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { useDownloadList } from "@/hooks/use-download-list";
import { DownloadCard } from "../../components/DownloadCard";

const ResourcesPage: FC = () => {
  const { items, loading, handlePause, handleResume, handleDelete } =
    useDownloadList();
  const [itemToDelete, setItemToDelete] = useState<DownloadItem | null>(null);

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    const success = await handleDelete(itemToDelete.hash);
    if (success) {
      setItemToDelete(null);
    }
  };

  const downloadingItems = useMemo(
    () => items.filter((item) => item.progress < 100),
    [items],
  );
  const downloadedItems = useMemo(
    () => items.filter((item) => item.progress >= 100),
    [items],
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

  const renderList = (list: DownloadItem[], emptyMsg: string, icon?: React.ReactNode) => {
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
          />
        ))}
      </div>
    );
  };

  return (
    <>
      <div className="container mx-auto max-w-5xl p-6 space-y-6">
        <Tabs defaultValue="downloading" className="w-full">
          <div className="flex items-center justify-between mb-6">
            <TabsList className="grid w-full max-w-[400px] grid-cols-3">
              <TabsTrigger value="downloading" className="gap-2">
                <Download className="size-4" />
                下载中
                <Badge variant="secondary" className="ml-1 px-1 py-0 text-[10px] h-4 min-w-[1.25rem]">
                  {downloadingItems.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="downloaded" className="gap-2">
                <CheckCircle2 className="size-4" />
                已完成
                <Badge variant="secondary" className="ml-1 px-1 py-0 text-[10px] h-4 min-w-[1.25rem]">
                  {downloadedItems.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="all" className="gap-2">
                <ListFilter className="size-4" />
                全部
                <Badge variant="secondary" className="ml-1 px-1 py-0 text-[10px] h-4 min-w-[1.25rem]">
                  {items.length}
                </Badge>
              </TabsTrigger>
            </TabsList>

            {totalSpeed > 0 && (
                <div className="hidden sm:flex items-center gap-2 rounded-full border bg-background/50 px-4 py-1.5 backdrop-blur-sm">
                <div className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500"></span>
                </div>
                <span className="text-sm font-medium tabular-nums">
                    {formatTotalSpeed(totalSpeed)}
                </span>
                </div>
            )}
          </div>

          <div className="min-h-[60vh]">
            <TabsContent value="downloading" className="mt-0 outline-none">
              {renderList(downloadingItems, "暂无进行中的下载任务", <Download className="size-10 opacity-40" />)}
            </TabsContent>
            <TabsContent value="downloaded" className="mt-0 outline-none">
              {renderList(downloadedItems, "暂无已完成的资源", <CheckCircle2 className="size-10 opacity-40" />)}
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
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive hover:bg-destructive/90"
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
