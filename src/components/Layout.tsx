import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarInset } from "./ui/sidebar";
import AppSidebar from "./Sidebar";
import { Toaster } from "sonner"; // 引入 Sonner Toaster 组件
import { Loader2 } from "lucide-react"; // 引入加载动画

interface LayoutProps {
  preloadMap: Record<string, () => void>;
}

export function Layout({ preloadMap }: LayoutProps) {
  return (
    <SidebarProvider>
      <div className="flex w-full">
        <AppSidebar preloadMap={preloadMap} />
        <SidebarInset>
          <div className="p-6">
            <Suspense
              fallback={
                <div className="flex h-full w-full items-center justify-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <span className="text-lg text-muted-foreground">
                    加载中...
                  </span>
                </div>
              }
            >
              <Outlet />
            </Suspense>
          </div>
        </SidebarInset>
      </div>
      <Toaster position="bottom-right" /> {/* 添加全局 Toaster 组件 */}
    </SidebarProvider>
  );
}
