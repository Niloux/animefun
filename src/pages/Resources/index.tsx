import { FC, useMemo, useState } from "react";
import { DownloadItem } from "@/types/gen/downloader";
import { HardDriveDownload } from "lucide-react";
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

  const renderList = (list: DownloadItem[], emptyMsg: string) => {
    if (loading && items.length === 0) {
      return (
        <div className="p-8 text-center text-muted-foreground flex items-center justify-center gap-2">
          <Spinner className="size-4" />
          <span>加载资源列表...</span>
        </div>
      );
    }

    if (list.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-[60vh] text-muted-foreground">
          <HardDriveDownload className="w-16 h-16 mb-4 opacity-20" />
          <p>{emptyMsg}</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 gap-4">
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
      <div className="container mx-auto p-6 max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold tracking-tight">资源管理</h1>
        </div>

        <Tabs defaultValue="downloading" className="w-full">
          <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
            <TabsTrigger value="downloading">
              下载中 ({downloadingItems.length})
            </TabsTrigger>
            <TabsTrigger value="downloaded">
              已完成 ({downloadedItems.length})
            </TabsTrigger>
            <TabsTrigger value="all">全部 ({items.length})</TabsTrigger>
          </TabsList>
          <div className="mt-6">
            <TabsContent value="downloading">
              {renderList(downloadingItems, "暂无下载任务")}
            </TabsContent>
            <TabsContent value="downloaded">
              {renderList(downloadedItems, "暂无已完成资源")}
            </TabsContent>
            <TabsContent value="all">
              {renderList(items, "暂无任何资源")}
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
            <AlertDialogTitle>确认删除？</AlertDialogTitle>
            <AlertDialogDescription>
              这将永久删除任务及文件：
              <span className="font-semibold text-foreground mx-1">
                {itemToDelete?.title}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ResourcesPage;
