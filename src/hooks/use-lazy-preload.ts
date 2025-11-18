import { lazy, LazyExoticComponent } from "react";

type ComponentModule<T> = { default: T };

export function lazyWithPreload<T extends React.ComponentType>(
  importFn: () => Promise<ComponentModule<T>>
): LazyExoticComponent<T> & { preload: () => Promise<void> } {
  let loaded: Promise<ComponentModule<T>> | undefined;
  const load = () => {
    if (!loaded) loaded = importFn();
    return loaded;
  };
  const lazyComponent = lazy(() => load());
  const preload = () => load().then(() => {});
  return Object.assign(lazyComponent, { preload });
}
