import { lazy, LazyExoticComponent } from "react";

type ComponentModule<T> = { default: T };

/**
 * 扩展 React.lazy，添加 preload 方法支持预加载
 * @param importFn 动态导入函数
 * @returns 带有 preload 方法的 lazy 组件
 */
export function lazyWithPreload<T extends React.ComponentType>(
  importFn: () => Promise<ComponentModule<T>>
): LazyExoticComponent<T> & { preload: () => Promise<void> } {
  const lazyComponent = lazy(importFn);

  // 创建 preload 方法，直接调用 importFn 实现预加载
  const preload = () => importFn().then(() => {});

  // 将 preload 方法附加到 lazyComponent 上
  return Object.assign(lazyComponent, { preload });
}
