import { memo, useCallback, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, Search, BookOpen, Folder, Settings, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from "lucide-react";
import ikuyoAvatar from "../assets/ikuyo-avatar.png";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarFooter,
  SidebarRail,
  useSidebar,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from "./ui/sidebar";

export const AppSidebar = memo(function AppSidebar() {
  const location = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const [isResourcesOpen, setIsResourcesOpen] = useState(true);

  const handleToggleSidebar = useCallback(() => {
    toggleSidebar();
  }, [toggleSidebar]);

  const toggleResources = useCallback(() => {
    setIsResourcesOpen(prev => !prev);
  }, []);

  const isActive = useCallback((path: string) => {
    return location.pathname === path;
  }, [location.pathname]);

  // 使用 useMemo 缓存菜单项
  const menuItems = useMemo(() => [
    {
      title: "首页",
      url: "/home",
      icon: Home,
    },
    {
      title: "搜索",
      url: "/search",
      icon: Search,
    },
    {
      title: "订阅",
      url: "/subscribe",
      icon: BookOpen,
    },
  ], []);

  return (
    <Sidebar collapsible="icon" className="group">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="group-data-[state=collapsed]:size-10">
              <img
                src={ikuyoAvatar}
                alt="ikuyo-avatar"
                className="rounded-full w-14 h-14 group-data-[state=collapsed]:w-8 group-data-[state=collapsed]:h-8"
              />
              <div className="text-left overflow-hidden whitespace-nowrap">
                {/* <span className="text-xl font-semibold">For Fun</span> */}
                <div className="font-semibold opacity-100 group-data-[state=collapsed]:opacity-0 group-data-[state=collapsed]:pointer-events-none transition-opacity">喜多郁代</div>
                <div className="text-xs text-gray-400 opacity-100 group-data-[state=collapsed]:opacity-0 group-data-[state=collapsed]:pointer-events-none transition-opacity">きた,いくよ</div>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="opacity-100 group-data-[state=collapsed]:opacity-0 group-data-[state=collapsed]:pointer-events-none transition-opacity">导航</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                  >
                    <Link to={item.url}>
                      <item.icon />
                      <span className="opacity-100 group-data-[state=collapsed]:opacity-0 transition-opacity duration-300 whitespace-nowrap">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {/* 资源下拉菜单 */}
              <SidebarMenuItem>
                <SidebarMenuButton onClick={toggleResources} className="group/resources">
                  <Folder />
                  <span className="opacity-100 group-data-[state=collapsed]:opacity-0 transition-opacity duration-300 whitespace-nowrap">资源</span>
                  <span className="ml-auto flex-shrink-0">
                    {isResourcesOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </span>
                </SidebarMenuButton>
                {isResourcesOpen && (
                  <SidebarMenuSub>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        asChild
                        isActive={isActive("/resources/all")}
                      >
                        <Link to="/resources/all">
                          <span className="opacity-100 group-data-[state=collapsed]:opacity-0 transition-opacity duration-300 whitespace-nowrap">全部</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        asChild
                        isActive={isActive("/resources/downloading")}
                      >
                        <Link to="/resources/downloading">
                          <span className="opacity-100 group-data-[state=collapsed]:opacity-0 transition-opacity duration-300 whitespace-nowrap">下载中</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        asChild
                        isActive={isActive("/resources/downloaded")}
                      >
                        <Link to="/resources/downloaded">
                          <span className="opacity-100 group-data-[state=collapsed]:opacity-0 transition-opacity duration-300 whitespace-nowrap">已下载</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                )}
              </SidebarMenuItem>

              {/* 设置 */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/settings")}
                >
                  <Link to="/settings">
                    <Settings />
                    <span className="opacity-100 group-data-[state=collapsed]:opacity-0 transition-opacity duration-300 whitespace-nowrap">设置</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleToggleSidebar}
              tooltip={state === "expanded" ? "收起侧边栏" : "展开侧边栏"}
            >
              {state === "expanded" ? (
                <>
                  <ChevronLeft />
                  <span>收起</span>
                </>
              ) : (
                <ChevronRight />
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
});

export default AppSidebar;