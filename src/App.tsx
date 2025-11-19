import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { lazyWithPreload } from "./hooks/use-lazy-preload";
import { Layout } from "./components/Layout";
import { ROUTES } from "./constants/routes";
import ErrorBoundary from "./components/ErrorBoundary";
import "./App.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query";

// 使用自定义的 lazyWithPreload 动态导入所有页面组件，并添加块名称便于分析
const HomePage = lazyWithPreload(() => import("./pages/Home"));
const SearchPage = lazyWithPreload(() => import("./pages/Search"));
const SubscribePage = lazyWithPreload(() => import("./pages/Subscribe"));
const ResourcesAllPage = lazyWithPreload(() => import("./pages/Resources/All"));
const ResourcesDownloadingPage = lazyWithPreload(() => import("./pages/Resources/Downloading"));
const ResourcesDownloadedPage = lazyWithPreload(() => import("./pages/Resources/Downloaded"));
const SettingsPage = lazyWithPreload(() => import("./pages/Settings"));
const AnimeDetailPage = lazyWithPreload(() => import("./pages/AnimeDetail"));

 

function App() {
  // 创建预加载函数映射表
  const preloadMap = {
    [ROUTES.HOME]: HomePage.preload,
    [ROUTES.SEARCH]: SearchPage.preload,
    [ROUTES.SUBSCRIBE]: SubscribePage.preload,
    [ROUTES.RESOURCES.ALL]: ResourcesAllPage.preload,
    [ROUTES.RESOURCES.DOWNLOADING]: ResourcesDownloadingPage.preload,
    [ROUTES.RESOURCES.DOWNLOADED]: ResourcesDownloadedPage.preload,
    [ROUTES.SETTINGS]: SettingsPage.preload,
  };

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
              <Route path={ROUTES.RESOURCES.ALL} element={<ResourcesAllPage />} />
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
