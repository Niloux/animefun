import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarInset } from "./ui/sidebar";
import AppSidebar from "./Sidebar";
import { Toaster } from "sonner"; // 引入 Sonner Toaster 组件

export function Layout() {
  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <AppSidebar />
        <SidebarInset>
          <div className="p-6">
            <Outlet />
          </div>
        </SidebarInset>
      </div>
      <Toaster position="bottom-right" /> {/* 添加全局 Toaster 组件 */}
    </SidebarProvider>
  );
}
