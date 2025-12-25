import { useState, useCallback, useEffect } from "react";
import { DownloadItem } from "@/types/gen/downloader";
import type { TorrentInfo } from "@/types/gen/torrent_info";
import {
  getTrackedDownloads,
  getLiveDownloadInfo,
  pauseDownload,
  resumeDownload,
  deleteDownload,
} from "@/lib/api";
import { toast } from "sonner";

const POLL_INTERVAL = 2000;

function mergeLiveInfo(
  items: DownloadItem[],
  liveInfos: TorrentInfo[],
): DownloadItem[] {
  return items.map((item) => {
    const live = liveInfos.find((l) => l.hash === item.hash);
    if (live) {
      return {
        ...item,
        progress: live.progress * 100,
        dlspeed: live.dlspeed,
        eta: live.eta,
        status: live.state,
      };
    }
    return item;
  });
}

export function useDownloadList() {
  const [items, setItems] = useState<DownloadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCheckingConnection, setIsCheckingConnection] = useState(true);
  const [isConnectionError, setIsConnectionError] = useState(false);

  // 核心初始化逻辑
  const init = useCallback(async () => {
    setIsCheckingConnection(true);
    setLoading(true); // 确保在重试时也会显示 loading
    try {
      // 并行请求：既能加速，又能分开处理结果
      const [liveInfoResult, trackedResult] = await Promise.allSettled([
        getLiveDownloadInfo(),
        getTrackedDownloads(),
      ]);

      // 1. 检查连接是否成功
      if (liveInfoResult.status === "rejected") {
        throw liveInfoResult.reason;
      }

      setIsConnectionError(false);

      // 2. 处理本地列表数据
      if (trackedResult.status === "fulfilled") {
        setItems(trackedResult.value);
      } else {
        toast.error("Failed to load downloads list");
      }

      // 3. 立即应用一次实时数据
      const liveInfos = liveInfoResult.value;
      setItems((prev) => mergeLiveInfo(prev, liveInfos));
    } catch (e) {
      console.error("Connection check failed:", e);
      setIsConnectionError(true);
      setItems([]);
    } finally {
      setIsCheckingConnection(false);
      setLoading(false);
    }
  }, []);

  const updateLiveInfo = useCallback(async () => {
    try {
      const liveInfos = await getLiveDownloadInfo();
      setIsConnectionError(false);
      setItems((prev) => mergeLiveInfo(prev, liveInfos));
    } catch (e) {
      console.error(e);
      setIsConnectionError(true);
    }
  }, []);

  // 初始流程
  useEffect(() => {
    init();
  }, [init]);

  // 定时轮询：仅在连接正常时进行
  useEffect(() => {
    if (isCheckingConnection || isConnectionError) return;

    const timer = window.setInterval(updateLiveInfo, POLL_INTERVAL);
    return () => window.clearInterval(timer);
  }, [updateLiveInfo, isCheckingConnection, isConnectionError]);

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
    try {
      await deleteDownload(hash, true);
      toast.success("Deleted");
      setItems((prev) => prev.filter((i) => i.hash !== hash));
      return true;
    } catch {
      toast.error("Failed to delete");
      return false;
    }
  };

  return {
    items,
    loading,
    isCheckingConnection,
    isConnectionError,
    isConnected: !isConnectionError && !isCheckingConnection, // 暴露连接状态
    retryConnection: init,
    handlePause,
    handleResume,
    handleDelete,
  };
}
