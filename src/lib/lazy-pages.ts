import { lazyWithPreload } from "../hooks/use-lazy-preload";
import { ROUTES } from "../constants/routes";

// 导入并预加载所有页面组件
export const HomePage = lazyWithPreload(() => import("../pages/Home"));
export const SearchPage = lazyWithPreload(() => import("../pages/Search"));
export const SubscribePage = lazyWithPreload(() => import("../pages/Subscribe"));
export const ResourcesAllPage = lazyWithPreload(() => import("../pages/Resources/All"));
export const ResourcesDownloadingPage = lazyWithPreload(() => import("../pages/Resources/Downloading"));
export const ResourcesDownloadedPage = lazyWithPreload(() => import("../pages/Resources/Downloaded"));
export const SettingsPage = lazyWithPreload(() => import("../pages/Settings"));
export const AnimeDetailPage = lazyWithPreload(() => import("../pages/AnimeDetail"));

// 预加载映射表，与路由一一对应
export const preloadMap = {
  [ROUTES.HOME]: HomePage.preload,
  [ROUTES.SEARCH]: SearchPage.preload,
  [ROUTES.SUBSCRIBE]: SubscribePage.preload,
  [ROUTES.RESOURCES.ALL]: ResourcesAllPage.preload,
  [ROUTES.RESOURCES.DOWNLOADING]: ResourcesDownloadingPage.preload,
  [ROUTES.RESOURCES.DOWNLOADED]: ResourcesDownloadedPage.preload,
  [ROUTES.SETTINGS]: SettingsPage.preload,
};