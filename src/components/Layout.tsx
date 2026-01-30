import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarInset } from "./ui/sidebar";
import AppSidebar from "./Sidebar";
import { Loader2 } from "lucide-react";

interface LayoutProps {
  preloadMap: Record<string, () => Promise<unknown>>;
}

export function Layout({ preloadMap }: LayoutProps) {
  return (
    <SidebarProvider>
      <div className="flex w-full h-svh overflow-hidden">
        <AppSidebar preloadMap={preloadMap} />
        <SidebarInset className="min-h-0 overflow-auto">
          <div className="p-4 md:p-6">
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
    </SidebarProvider>
  );
}
