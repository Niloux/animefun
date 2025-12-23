import { lazyWithPreload } from "../hooks/use-lazy-preload";
import { ROUTES } from "../constants/routes";

// 导入并预加载所有页面组件
export const HomePage = lazyWithPreload(() => import("../pages/Home"));
export const SearchPage = lazyWithPreload(() => import("../pages/Search"));
export const SubscribePage = lazyWithPreload(() => import("../pages/Subscribe"));
export const ResourcesPage = lazyWithPreload(() => import("../pages/Resources"));
export const SettingsPage = lazyWithPreload(() => import("../pages/Settings"));
export const AnimeDetailPage = lazyWithPreload(() => import("../pages/AnimeDetail"));

// 预加载映射表，与路由一一对应
export const preloadMap = {
  [ROUTES.HOME]: HomePage.preload,
  [ROUTES.SEARCH]: SearchPage.preload,
  [ROUTES.SUBSCRIBE]: SubscribePage.preload,
  [ROUTES.RESOURCES]: ResourcesPage.preload,
  [ROUTES.SETTINGS]: SettingsPage.preload,
};
