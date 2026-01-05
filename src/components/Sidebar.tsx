import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Folder,
  Home,
  Search,
  Settings,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useMemo, useCallback, useState } from "react";
import { ROUTES } from "../constants/routes";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "./ui/sidebar";
import { useDownloadList } from "@/hooks/use-download-list";
import { useUserProfile } from "@/hooks/use-user-profile";
import { UserProfileDialog } from "@/components/UserProfileDialog";

type MenuItem = {
  title: string;
  url: string;
  icon?: React.ElementType;
};

interface AppSidebarProps {
  preloadMap: Record<string, () => void>;
}

export const AppSidebar = function AppSidebar({ preloadMap }: AppSidebarProps) {
  const location = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const { items } = useDownloadList();
  const { profile, avatarDataUrl } = useUserProfile();
  const [showProfileDialog, setShowProfileDialog] = useState(false);

  const downloadingCount = useMemo(
    () => items.filter((item) => item.progress < 100).length,
    [items],
  );

  const isActive = (path: string) => location.pathname === path;

  const handlePreload = (path: string) => {
    preloadMap[path]?.();
  };

  const getAvatarSrc = useCallback(() => {
    if (profile.has_custom_avatar && avatarDataUrl) {
      return avatarDataUrl;
    }
    return new URL("../assets/ikuyo-avatar.png", import.meta.url).href;
  }, [profile.has_custom_avatar, avatarDataUrl]);

  const menuItems: MenuItem[] = [
    { title: "首页", url: ROUTES.HOME, icon: Home },
    { title: "搜索", url: ROUTES.SEARCH, icon: Search },
    { title: "订阅", url: ROUTES.SUBSCRIBE, icon: BookOpen },
    { title: "资源", url: ROUTES.RESOURCES, icon: Folder },
    { title: "设置", url: ROUTES.SETTINGS, icon: Settings },
  ];

  return (
    <Sidebar collapsible="icon" className="group">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="group-data-[state=collapsed]:size-10 p-8"
              onClick={() => setShowProfileDialog(true)}
            >
              <img
                src={getAvatarSrc()}
                alt="avatar"
                className="rounded-2xl w-14 h-14 group-data-[state=collapsed]:w-8 group-data-[state=collapsed]:h-8"
              />
              <div className="text-left overflow-hidden whitespace-nowrap">
                <div className="font-semibold opacity-100 group-data-[state=collapsed]:opacity-0 group-data-[state=collapsed]:pointer-events-none transition-opacity">
                  {profile.name}
                </div>
                <div className="text-xs text-gray-400 opacity-100 group-data-[state=collapsed]:opacity-0 group-data-[state=collapsed]:pointer-events-none transition-opacity">
                  {profile.bio}
                </div>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="opacity-100 group-data-[state=collapsed]:opacity-0 group-data-[state=collapsed]:pointer-events-none transition-opacity">
            导航
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isResources = item.title === "资源";
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.url)}
                      onMouseEnter={() => handlePreload(item.url)}
                    >
                      <Link to={item.url}>
                        {item.icon && <item.icon />}
                        <span className="opacity-100 group-data-[state=collapsed]:opacity-0 transition-opacity duration-300 whitespace-nowrap">
                          {item.title}
                        </span>
                        {isResources && downloadingCount > 0 && (
                          <SidebarMenuBadge className="bg-primary text-primary-foreground shadow-sm animate-pulse">
                            {downloadingCount}
                          </SidebarMenuBadge>
                        )}
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
              className="cursor-pointer"
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

      <UserProfileDialog
        open={showProfileDialog}
        onOpenChange={setShowProfileDialog}
      />
    </Sidebar>
  );
};

export default AppSidebar;
