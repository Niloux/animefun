import { queryClient } from "@/lib/query";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useEffect } from "react";
import "./App.css";
import "sonner/dist/styles.css";
import ErrorBoundary from "./components/ErrorBoundary";
import { Layout } from "./components/Layout";
import { ROUTES } from "./constants/routes";
import { Toaster } from "@/components/ui/sonner";
import { ConnectionProvider } from "@/hooks/use-connection-state";
import { UpdateDialog, useAutoUpdateCheck } from "@/components/UpdateDialog";

// 从集中模块导入所有懒加载页面和预加载映射表
import {
  AnimeDetailPage,
  HomePage,
  preloadMap,
  ResourcesPage,
  SearchPage,
  SettingsPage,
  SubscribePage,
} from "./lib/lazy-pages";

function AppContent() {
  const { updateInfo, showDialog, setShowDialog, checkForUpdates } = useAutoUpdateCheck();

  useEffect(() => {
    // 延迟检查更新，避免影响启动速度
    const timer = window.setTimeout(() => {
      checkForUpdates();
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [checkForUpdates]);

  return (
    <>
      <Routes>
        <Route path="/" element={<Layout preloadMap={preloadMap} />}>
          <Route index element={<Navigate to={ROUTES.HOME} replace />} />
          <Route path={ROUTES.HOME} element={<HomePage />} />
          <Route path={ROUTES.SEARCH} element={<SearchPage />} />
          <Route path={ROUTES.SUBSCRIBE} element={<SubscribePage />} />
          <Route path={ROUTES.RESOURCES} element={<ResourcesPage />} />
          <Route path={ROUTES.SETTINGS} element={<SettingsPage />} />
          <Route
            path={ROUTES.ANIME_DETAIL}
            element={<AnimeDetailPage />}
          />
          <Route
            path="*"
            element={<Navigate to={ROUTES.HOME} replace />}
          />
        </Route>
      </Routes>
      <UpdateDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        updateInfo={updateInfo}
      />
    </>
  );
}

function App() {
  return (
    <ConnectionProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ErrorBoundary>
            <Toaster position="bottom-right" />
            <AppContent />
          </ErrorBoundary>
        </BrowserRouter>
      </QueryClientProvider>
    </ConnectionProvider>
  );
}

export default App;
