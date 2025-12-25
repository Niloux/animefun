import { useState, useEffect } from "react";
import { getLiveDownloadInfo } from "@/lib/api";

export function useDownloaderConnection() {
  const [isConnected, setIsConnected] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkConnection = async () => {
      try {
        await getLiveDownloadInfo();
        setIsConnected(true);
      } catch {
        setIsConnected(false);
      } finally {
        setIsChecking(false);
      }
    };

    checkConnection();
  }, []);

  return { isConnected, isChecking };
}
