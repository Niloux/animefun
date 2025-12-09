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

  const fetchList = useCallback(async () => {
    try {
      const data = await getTrackedDownloads();
      setItems(data);
    } catch {
      toast.error("Failed to load downloads");
    } finally {
      setLoading(false);
    }
  }, []);

  const updateLiveInfo = useCallback(async () => {
    try {
      const liveInfos = await getLiveDownloadInfo();
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
    }
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  useEffect(() => {
    const timer = window.setInterval(updateLiveInfo, 2000);
    return () => window.clearInterval(timer);
  }, [updateLiveInfo]);

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
    handlePause,
    handleResume,
    handleDelete,
  };
}
