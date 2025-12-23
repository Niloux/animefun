import { useState, useCallback, useEffect } from "react";
import { DownloadItem } from "@/types/gen/downloader";
import {
  getTrackedDownloads,
  getLiveDownloadInfo,
  pauseDownload,
  resumeDownload,
  deleteDownload,
} from "@/lib/api";
import { toast } from "sonner";

export function useDownloadList() {
  const [items, setItems] = useState<DownloadItem[]>([]);
  const [loading, setLoading] = useState(true);
  // 新增：连接检查状态，初始为 true，检查完成后变为 false
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

      // 3. 立即应用一次实时数据（如果有）
      // 注意：这里不需要再调 updateLiveInfo，因为我们已经拿到了 liveInfoResult
      const liveInfos = liveInfoResult.value;
      setItems((prev) => {
        return prev.map((item) => {
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
      });
    } catch (e) {
      console.error("Connection check failed:", e);
      setIsConnectionError(true);
    } finally {
      setIsCheckingConnection(false);
      setLoading(false);
    }
  }, []);

  const updateLiveInfo = useCallback(async () => {
    try {
      const liveInfos = await getLiveDownloadInfo();
      // 如果调用成功，说明连接正常
      setIsConnectionError(false);

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
      // getLiveDownloadInfo 失败通常意味着连接问题（如配置错误或服务未启动）
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

    const timer = window.setInterval(updateLiveInfo, 2000);
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
    retryConnection: init, // 暴露重试方法
    handlePause,
    handleResume,
    handleDelete,
  };
}
