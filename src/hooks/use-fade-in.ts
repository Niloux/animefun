import * as React from "react";

interface UseFadeInOptions {
  delay?: number;
}

/**
 * 内容淡入动画 Hook
 * @param trigger - 触发淡入的条件（如 data !== undefined）
 * @param options - 配置项
 * @returns isVisible - 是否应该显示内容（控制 opacity）
 */
export function useFadeIn(
  trigger: boolean,
  options: UseFadeInOptions = {},
): boolean {
  const { delay = 0 } = options;
  const [isVisible, setIsVisible] = React.useState(false);

  React.useEffect(() => {
    if (!trigger) {
      setIsVisible(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setIsVisible(true);
    }, delay);

    return () => window.clearTimeout(timer);
  }, [trigger, delay]);

  return isVisible;
}
