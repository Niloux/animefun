import {
  useState,
  useEffect,
  useCallback,
  createContext,
  useContext,
} from "react";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { testDownloaderConnection } from "@/lib/api";
import { toast } from "sonner";

interface ConnectionStateContextValue {
  isConnected: boolean;
  isChecking: boolean;
  setIsConnected: (connected: boolean) => void;
  setIsChecking: (checking: boolean) => void;
}

const ConnectionStateContext =
  createContext<ConnectionStateContextValue | null>(null);

/**
 * 连接状态 Provider
 *
 * 在应用顶层包裹，确保全局只有一个状态实例
 */
export function ConnectionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isConnected, setIsConnected] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let unlisten: UnlistenFn | null = null;

    const setupListener = async () => {
      try {
        unlisten = await listen<boolean>(
          "downloader-connection-state",
          (event) => {
            setIsConnected(event.payload);
            setIsChecking(false);
          },
        );

        // 初始化时主动检测一次连接状态
        // 避免被动等待后端事件导致启动时状态不准确
        try {
          await testDownloaderConnection();
          setIsConnected(true);
        } catch {
          setIsConnected(false);
        } finally {
          setIsChecking(false);
        }
      } catch (e) {
        console.error("Failed to setup connection listener:", e);
        setIsChecking(false);
      }
    };

    setupListener();

    return () => {
      unlisten?.();
    };
  }, []);

  const setConnectionState = useCallback((connected: boolean) => {
    setIsConnected(connected);
    setIsChecking(false);
  }, []);

  const setChecking = useCallback((checking: boolean) => {
    setIsChecking(checking);
  }, []);

  return (
    <ConnectionStateContext.Provider
      value={{
        isConnected,
        isChecking,
        setIsConnected: setConnectionState,
        setIsChecking: setChecking,
      }}
    >
      {children}
    </ConnectionStateContext.Provider>
  );
}

/**
 * 获取全局连接状态
 *
 * 所有使用此 hook 的组件共享同一个状态实例
 */
export function useConnectionState() {
  const context = useContext(ConnectionStateContext);
  if (!context) {
    throw new Error(
      "useConnectionState must be used within ConnectionProvider",
    );
  }
  return context;
}

/**
 * 连接状态 + 测试连接功能的 Hook
 *
 * 用于 Settings 页面，提供测试连接按钮功能
 */
export function useDownloaderConnection() {
  const { isConnected, isChecking, setIsConnected, setIsChecking } =
    useConnectionState();
  const [isTesting, setIsTesting] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const testConnection = useCallback(async () => {
    setIsTesting(true);
    setIsChecking(true);
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
      setIsChecking(false);
    }
  }, [setIsConnected, setIsChecking]);

  return { isConnected, isTesting, isChecking, lastCheck, testConnection };
}
