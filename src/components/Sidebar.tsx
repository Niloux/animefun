import { useState } from "react";
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

// 定义菜单结构类型
type MenuItem = {
  title: string;
  url?: string;
  icon?: React.ElementType;
  children?: MenuItem[];
};

export const AppSidebar = function AppSidebar() {
  const location = useLocation();
  const { state, toggleSidebar } = useSidebar();
  // 使用Set存储展开的菜单标题，支持多菜单展开
  const [openMenus, setOpenMenus] = useState<Set<string>>(new Set(["资源"]));

  // 检查路径是否激活
  const isActive = (path: string) => location.pathname === path;

  // 切换菜单展开状态
  const toggleMenu = (title: string) => {
    setOpenMenus(prev => {
      const newSet = new Set(prev);
      if (newSet.has(title)) {
        newSet.delete(title);
      } else {
        newSet.add(title);
      }
      return newSet;
    });
  };

  // 统一的菜单配置，支持嵌套结构
  const menuItems: MenuItem[] = [
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
    {
      title: "资源",
      icon: Folder,
      children: [
        { title: "全部", url: "/resources/all" },
        { title: "下载中", url: "/resources/downloading" },
        { title: "已下载", url: "/resources/downloaded" },
      ],
    },
    {
      title: "设置",
      url: "/settings",
      icon: Settings,
    },
  ];

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
              {menuItems.map((item) => {
                // 有子菜单的父项
                if (item.children) {
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton onClick={() => toggleMenu(item.title)} className="group/resources">
                        {item.icon && <item.icon />}
                        <span className="opacity-100 group-data-[state=collapsed]:opacity-0 transition-opacity duration-300 whitespace-nowrap">{item.title}</span>
                        <span className="ml-auto shrink-0">
                          {openMenus.has(item.title) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </span>
                      </SidebarMenuButton>
                      {openMenus.has(item.title) && (
                        <SidebarMenuSub>
                          {item.children.map((child) => (
                            <SidebarMenuSubItem key={child.title}>
                              <SidebarMenuSubButton
                                asChild
                                isActive={isActive(child.url!)}
                              >
                                <Link to={child.url!}>
                                  <span className="opacity-100 group-data-[state=collapsed]:opacity-0 transition-opacity duration-300 whitespace-nowrap">{child.title}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      )}
                    </SidebarMenuItem>
                  );
                }

                // 普通菜单项
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.url!)}
                    >
                      <Link to={item.url!}>
                        {item.icon && <item.icon />}
                        <span className="opacity-100 group-data-[state=collapsed]:opacity-0 transition-opacity duration-300 whitespace-nowrap">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => toggleSidebar()}
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
};

export default AppSidebar;