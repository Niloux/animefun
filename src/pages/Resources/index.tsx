import { FC, useMemo, useState } from "react";
import { DownloadItem } from "@/types/gen/downloader";
import {
  HardDriveDownload,
  AlertCircle,
  Settings,
  RefreshCw,
} from "lucide-react";
import { Link } from "react-router-dom";
import { ROUTES } from "@/constants/routes";
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
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useDownloadList } from "@/hooks/use-download-list";
import { DownloadCard } from "../../components/DownloadCard";

const ResourcesPage: FC = () => {
  const {
    items,
    loading,
    isCheckingConnection,
    isConnectionError,
    retryConnection,
    handlePause,
    handleResume,
    handleDelete,
  } = useDownloadList();
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
    // 列表内部的 loading 状态仅在初次获取数据时显示，通常非常快
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

  // 1. 优先处理全屏 Loading（正在检查连接）
  if (isCheckingConnection) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] gap-4">
        <Spinner className="size-8 text-muted-foreground" />
        <p className="text-muted-foreground text-sm">正在连接下载器...</p>
      </div>
    );
  }

  // 2. 其次处理全屏错误（连接失败）
  if (isConnectionError) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] gap-6 text-center px-4">
        <div className="p-6 bg-destructive/10 rounded-full">
          <AlertCircle className="w-16 h-16 text-destructive" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">
            无法连接到下载器
          </h2>
          <p className="text-muted-foreground max-w-[500px]">
            请确保 qBittorrent 已启动，并且 API 配置正确。
            <br />
            如果修改了配置，请尝试重新启动应用。
          </p>
        </div>
        <div className="flex gap-4">
          <Button onClick={retryConnection} size="lg" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            重试连接
          </Button>
          <Button asChild variant="outline" size="lg" className="gap-2">
            <Link to={ROUTES.SETTINGS}>
              <Settings className="w-4 h-4" />
              检查配置
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  // 3. 最后渲染正常内容
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
