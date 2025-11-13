import * as React from "react";

const MOBILE_BREAKPOINT = 768;

// 在客户端环境下获取初始值
const getInitialIsMobile = () => {
  // 服务端渲染时返回false，客户端直接获取窗口宽度
  if (typeof window === "undefined") return false;
  return window.innerWidth < MOBILE_BREAKPOINT;
};

export function useIsMobile() {
  // 直接用同步函数初始化状态，避免undefined
  const [isMobile, setIsMobile] = React.useState<boolean>(getInitialIsMobile);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);

    // 使用matchMedia的matches属性直接获取状态
    const onChange = () => setIsMobile(mql.matches);

    // 添加事件监听
    mql.addEventListener("change", onChange);

    // 清理函数
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile; // 直接返回boolean，不再需要!!isMobile
}
