import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDownloadList } from "@/hooks/use-download-list";
import { useProfile } from "@/hooks/use-profile";
import { resolveAvatarUrl } from "@/lib/utils";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Folder,
  Home,
  Pencil,
  Search,
  Settings,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ROUTES } from "../constants/routes";
import { ProfileEditDialog } from "./ProfileEditDialog";
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

const DEFAULT_USERNAME = "喜多郁代";
const DEFAULT_SIGNATURE = "きた,いくよ";

type MenuItem = {
  title: string;
  url: string;
  icon: React.ElementType;
};

interface AppSidebarProps {
  preloadMap: Record<string, () => Promise<unknown>>;
}

export const AppSidebar = function AppSidebar({ preloadMap }: AppSidebarProps) {
  const location = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const { items } = useDownloadList();
  const { profile, isLoading: isProfileLoading } = useProfile();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // 计算下载中的任务数量
  const downloadingCount = useMemo(
    () => items.filter((item) => item.progress < 100).length,
    [items]
  );

  const mainMenuItems: MenuItem[] = [
    { title: "主页", url: ROUTES.HOME, icon: Home },
    { title: "订阅", url: ROUTES.SUBSCRIBE, icon: BookOpen },
    { title: "资源", url: ROUTES.RESOURCES, icon: Folder },
    { title: "搜索", url: ROUTES.SEARCH, icon: Search },
  ];

  const footerMenuItems: MenuItem[] = [
    { title: "设置", url: ROUTES.SETTINGS, icon: Settings },
  ];

  const currentAvatar = resolveAvatarUrl(profile?.avatar_path);

  const displayUsername = isProfileLoading
    ? "..."
    : profile?.username || DEFAULT_USERNAME;
  const displaySignature = isProfileLoading
    ? ""
    : profile?.signature || DEFAULT_SIGNATURE;

  const isActive = (url: string) => location.pathname === url;

  const handlePreload = (url: string) => {
    if (preloadMap[url]) {
      preloadMap[url]();
    }
  };

  return (
    <Sidebar collapsible="icon" className="group">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <Tooltip>
              <TooltipTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="group-data-[state=collapsed]:size-10 p-2 h-14 hover:bg-accent/80 cursor-pointer transition-colors"
                  onClick={() => setIsDialogOpen(true)}
                >
                  <img
                    src={currentAvatar}
                    alt="avatar"
                    className="rounded-xl w-10 h-10 group-data-[state=collapsed]:w-8 group-data-[state=collapsed]:h-8 ring-2 ring-transparent hover:ring-primary/30 transition-all object-cover shrink-0"
                  />
                  <div className="text-left overflow-hidden whitespace-nowrap flex-1 min-w-0 ml-2">
                    <div className="font-semibold opacity-100 group-data-[state=collapsed]:opacity-0 group-data-[state=collapsed]:pointer-events-none transition-opacity flex items-center gap-1">
                      <span className="truncate">{displayUsername}</span>
                      <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity shrink-0" />
                    </div>
                    <div className="text-xs text-gray-400 opacity-100 group-data-[state=collapsed]:opacity-0 group-data-[state=collapsed]:pointer-events-none transition-opacity truncate">
                      {displaySignature}
                    </div>
                  </div>
                </SidebarMenuButton>
              </TooltipTrigger>
              <TooltipContent
                side="right"
                align="start"
                className="max-w-[260px]"
              >
                <div className="flex flex-col gap-1">
                  <p className="font-semibold">{displayUsername}</p>
                  {displaySignature && (
                    <p className="text-xs text-gray-400 whitespace-pre-wrap wrap-break-word">
                      {displaySignature}
                    </p>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          </SidebarMenuItem>{" "}
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="opacity-100 group-data-[state=collapsed]:opacity-0 group-data-[state=collapsed]:pointer-events-none transition-opacity">
            导航
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainMenuItems.map((item) => {
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
          {footerMenuItems.map((item) => (
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
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
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

      <ProfileEditDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} />
    </Sidebar>
  );
};

export default AppSidebar;
