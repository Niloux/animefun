import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { lazyWithPreload } from "./lib/hooks/useLazyPreload";
import { Layout } from "./components/Layout";
import { ROUTES } from "./constants/routes";
import ErrorBoundary from "./components/ErrorBoundary";
import "./App.css";

// 使用自定义的 lazyWithPreload 动态导入所有页面组件，并添加块名称便于分析
const HomePage = lazyWithPreload(() => import(/* viteChunkName: "page-home" */ "./pages/Home"));
const SearchPage = lazyWithPreload(() => import(/* viteChunkName: "page-search" */ "./pages/Search"));
const SubscribePage = lazyWithPreload(() => import(/* viteChunkName: "page-subscribe" */ "./pages/Subscribe"));
const ResourcesAllPage = lazyWithPreload(() => import(/* viteChunkName: "page-resources-all" */ "./pages/Resources/All"));
const ResourcesDownloadingPage = lazyWithPreload(() => import(/* viteChunkName: "page-resources-downloading" */ "./pages/Resources/Downloading"));
const ResourcesDownloadedPage = lazyWithPreload(() => import(/* viteChunkName: "page-resources-downloaded" */ "./pages/Resources/Downloaded"));
const SettingsPage = lazyWithPreload(() => import(/* viteChunkName: "page-settings" */ "./pages/Settings"));
const AnimeDetailPage = lazyWithPreload(() => import(/* viteChunkName: "page-anime-detail" */ "./pages/AnimeDetail"));

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
    <HashRouter>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Layout preloadMap={preloadMap} />}>
            {/* 默认重定向到首页 */}
            <Route index element={<Navigate to={ROUTES.HOME} replace />} />

            {/* 页面路由，懒加载的组件会由Layout中的Suspense处理 */}
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

            {/* 兜底路由 */}
            <Route path="*" element={<Navigate to={ROUTES.HOME} replace />} />
          </Route>
        </Routes>
      </ErrorBoundary>
    </HashRouter>
  );
}

export default App;
