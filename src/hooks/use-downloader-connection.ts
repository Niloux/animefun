import { useState, useEffect, useCallback } from "react";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { toast } from "sonner";
import { testDownloaderConnection } from "@/lib/api";

export function useDownloaderConnection() {
  const [isConnected, setIsConnected] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  useEffect(() => {
    let unlisten: UnlistenFn | null = null;

    const setupListener = async () => {
      try {
        unlisten = await listen<boolean>(
          "downloader-connection-state",
          (event) => {
            setIsConnected(event.payload);
            setLastCheck(new Date());
          },
        );
      } catch (e) {
        console.error("Failed to setup connection listener:", e);
      }
    };

    setupListener();

    return () => {
      unlisten?.();
    };
  }, []);

  const testConnection = useCallback(async () => {
    setIsTesting(true);
    try {
      const version = await testDownloaderConnection();
      toast.success(`连接成功！qBittorrent 版本: ${version}`);
      setIsConnected(true);
      setLastCheck(new Date());
    } catch (error) {
      toast.error((error as Error).message);
      setIsConnected(false);
    } finally {
      setIsTesting(false);
    }
  }, []);

  return { isConnected, isTesting, lastCheck, testConnection };
}
