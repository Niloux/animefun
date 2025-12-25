import { useState, useEffect } from "react";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { DownloadItem } from "@/types/gen/downloader";
import {
  getTrackedDownloads,
  pauseDownload,
  resumeDownload,
  deleteDownload,
} from "@/lib/api";
import { toast } from "sonner";

export function useDownloadList() {
  const [items, setItems] = useState<DownloadItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unlisten: UnlistenFn | null = null;

    const init = async () => {
      try {
        const initial = await getTrackedDownloads();
        setItems(initial);
        setLoading(false);

        unlisten = await listen<DownloadItem[]>(
          "download-status-updated",
          (event) => {
            setItems(event.payload);
          },
        );
      } catch (e) {
        console.error("Init failed:", e);
        setLoading(false);
      }
    };

    init();

    return () => {
      unlisten?.();
    };
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
