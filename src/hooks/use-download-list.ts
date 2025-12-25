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

export function useDownloadList() {
  const [items, setItems] = useState<DownloadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isCheckingConnection, setIsCheckingConnection] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setIsCheckingConnection(true);
      const initial = await getTrackedDownloads();
      setItems(initial);

      // Check connection
      try {
        await getLiveDownloadInfo();
        setIsConnected(true);
      } catch (e) {
        console.warn("Downloader connection check failed:", e);
        setIsConnected(false);
      }
    } catch (e) {
      console.error("Refresh failed:", e);
    } finally {
      setLoading(false);
      setIsCheckingConnection(false);
    }
  }, []);

  useEffect(() => {
    let unlistenStatus: UnlistenFn | null = null;
    let unlistenConnection: UnlistenFn | null = null;

    const initListener = async () => {
      refresh();

      try {
        unlistenStatus = await listen<DownloadItem[]>(
          "download-status-updated",
          (event) => {
            setItems(event.payload);
            // 这里不再盲目设置 isConnected(true)
            // 连接状态由 "downloader-connection-state" 事件或 refresh 中的检测决定
          },
        );

        unlistenConnection = await listen<boolean>(
          "downloader-connection-state",
          (event) => {
            setIsConnected(event.payload);
          },
        );
      } catch (e) {
        console.error("Listener init failed:", e);
      }
    };

    initListener();

    return () => {
      unlistenStatus?.();
      unlistenConnection?.();
    };
  }, [refresh]);

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
    isConnected,
    isCheckingConnection,
    refresh,
    handlePause,
    handleResume,
    handleDelete,
  };
}
