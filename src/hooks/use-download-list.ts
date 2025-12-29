import { useState, useEffect, useCallback } from "react";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { DownloadItem } from "@/types/gen/downloader";
import {
  getTrackedDownloads,
  getLiveDownloadInfo,
  pauseDownload,
  resumeDownload,
  deleteDownload,
} from "@/lib/api";
import { toast } from "sonner";
import { useConnectionState } from "./use-connection-state";

export function useDownloadList() {
  const [items, setItems] = useState<DownloadItem[]>([]);
  const [loading, setLoading] = useState(true);

  // 使用统一的连接状态管理
  const { isConnected, isChecking: isCheckingConnection, setIsConnected, setIsChecking } =
    useConnectionState();

  // 暴露给外部的 refresh 函数
  const refresh = useCallback(async () => {
    try {
      setIsChecking(true);

      const initial = await getTrackedDownloads();
      setItems(initial);
    } catch (e) {
      console.error("Failed to get tracked downloads:", e);
      setItems([]);
    }

    try {
      await getLiveDownloadInfo();
      setIsConnected(true);
    } catch (e) {
      console.warn("Downloader connection check failed:", e);
      setIsConnected(false);
    } finally {
      setLoading(false);
      setIsChecking(false);
    }
  }, [setIsConnected, setIsChecking]);

  // 初始化：只运行一次，避免监听器重复注册
  useEffect(() => {
    let unlistenStatus: UnlistenFn | null = null;

    const initListener = async () => {
      // 初始加载数据
      try {
        setIsChecking(true);

        const initial = await getTrackedDownloads();
        setItems(initial);
      } catch (e) {
        console.error("Failed to get tracked downloads:", e);
        setItems([]);
      }

      // 检测连接状态
      try {
        await getLiveDownloadInfo();
        setIsConnected(true);
      } catch (e) {
        console.warn("Downloader connection check failed:", e);
        setIsConnected(false);
      } finally {
        setLoading(false);
        setIsChecking(false);
      }

      // 监听下载状态更新事件
      try {
        unlistenStatus = await listen<DownloadItem[]>(
          "download-status-updated",
          (event) => {
            setItems(event.payload);
          },
        );
      } catch (e) {
        console.error("Listener init failed:", e);
      }
    };

    initListener();

    return () => {
      unlistenStatus?.();
    };
    // 依赖为空，只在挂载时运行一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePause = async (hash: string) => {
    try {
      await pauseDownload(hash);
      toast.success("Paused");
    } catch {
      toast.error("Failed to pause");
    }
  };

  const handleResume = async (hash: string) => {
    try {
      await resumeDownload(hash);
      toast.success("Resumed");
    } catch {
      toast.error("Failed to resume");
    }
  };

  const handleDelete = async (hash: string) => {
    try {
      await deleteDownload(hash, true);
      toast.success("Deleted");
      // 不再本地乐观更新，等待后端事件 "download-status-updated" 来更新列表
      // 这样可以确保前后端状态一致
      return true;
    } catch {
      toast.error("Failed to delete");
      return false;
    }
  };

  return {
    items,
    loading,
    isConnected,
    isCheckingConnection,
    refresh,
    handlePause,
    handleResume,
    handleDelete,
  };
}
