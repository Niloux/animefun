import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarInset } from "./ui/sidebar";
import AppSidebar from "./Sidebar";

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
    </SidebarProvider>
  );
}
