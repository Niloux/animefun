import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ROUTES } from "./constants/routes";
import ErrorBoundary from "./components/ErrorBoundary";
import "./App.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query";

// 从集中模块导入所有懒加载页面和预加载映射表
import {
  HomePage,
  SearchPage,
  SubscribePage,
  ResourcesAllPage,
  ResourcesDownloadingPage,
  ResourcesDownloadedPage,
  SettingsPage,
  AnimeDetailPage,
  preloadMap
} from "./lib/lazy-pages";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Layout preloadMap={preloadMap} />}>
              <Route index element={<Navigate to={ROUTES.HOME} replace />} />
              <Route path={ROUTES.HOME} element={<HomePage />} />
              <Route path={ROUTES.SEARCH} element={<SearchPage />} />
              <Route path={ROUTES.SUBSCRIBE} element={<SubscribePage />} />
              <Route
                path={ROUTES.RESOURCES.ALL}
                element={<ResourcesAllPage />}
              />
              <Route
                path={ROUTES.RESOURCES.DOWNLOADING}
                element={<ResourcesDownloadingPage />}
              />
              <Route
                path={ROUTES.RESOURCES.DOWNLOADED}
                element={<ResourcesDownloadedPage />}
              />
              <Route path={ROUTES.SETTINGS} element={<SettingsPage />} />
              <Route path={ROUTES.ANIME_DETAIL} element={<AnimeDetailPage />} />
              <Route path="*" element={<Navigate to={ROUTES.HOME} replace />} />
            </Route>
          </Routes>
        </ErrorBoundary>
      </HashRouter>
    </QueryClientProvider>
  );
}

export default App;
