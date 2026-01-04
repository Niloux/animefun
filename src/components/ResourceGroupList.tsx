import { openUrl } from "@tauri-apps/plugin-opener";
import { Download, WifiOff } from "lucide-react";
import { FC } from "react";
import { useNavigate } from "react-router-dom";
import { formatBytes } from "../lib/utils";
import type { MikanResourceItem } from "../types/gen/mikan";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { LoadingButton } from "./ui/loading-button";

interface ResourceGroupListProps {
  groups: { group: string; items: MikanResourceItem[] }[];
  onDownload: (url: string, title: string, item: MikanResourceItem) => void;
  isConnected?: boolean;
  isCheckingConnection?: boolean;
  isDownloading?: (url: string) => boolean;
}

export const ResourceGroupList: FC<ResourceGroupListProps> = ({
  groups,
  onDownload,
  isConnected = true,
  isCheckingConnection = false,
  isDownloading,
}) => {
  const navigate = useNavigate();
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.group} className="border rounded-md">
          <div className="px-3 py-2 font-semibold text-sm">{g.group}</div>
          <div className="divide-y">
            {g.items.map((it, idx) => (
              <div key={idx} className="p-3 space-y-2">
                <div className="text-sm font-medium">{it.title}</div>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {typeof it.resolution === "number" && (
                      <Badge
                        variant="secondary"
                        className="bg-chart-1 text-primary-foreground"
                      >
                        {it.resolution}p
                      </Badge>
                    )}
                    {it.subtitle_lang && (
                      <Badge
                        variant="secondary"
                        className="bg-chart-2 text-primary-foreground"
                      >
                        {it.subtitle_lang}
                      </Badge>
                    )}
                    {it.size_bytes != null && formatBytes(it.size_bytes) && (
                      <Badge
                        variant="secondary"
                        className="bg-chart-3 text-primary-foreground"
                      >
                        {formatBytes(it.size_bytes) as string}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {it.page_url && (
                      <Button
                        className="cursor-pointer"
                        variant="outline"
                        size="sm"
                        onClick={() => openUrl(it.page_url!)}
                      >
                        页面
                      </Button>
                    )}
                    {it.torrent_url && (
                      <LoadingButton
                        className="cursor-pointer"
                        variant={isConnected ? "outline" : "secondary"}
                        size="sm"
                        disabled={isCheckingConnection}
                        loading={
                          isDownloading ? isDownloading(it.torrent_url!) : false
                        }
                        loadingText="种子"
                        icon={
                          isConnected ? (
                            <Download className="w-4 h-4" />
                          ) : (
                            <WifiOff className="w-4 h-4 opacity-70" />
                          )
                        }
                        onClick={() => {
                          if (!isConnected) {
                            navigate("/settings");
                          } else {
                            onDownload(it.torrent_url!, it.title, it);
                          }
                        }}
                      >
                        {isConnected ? "种子" : "去配置"}
                      </LoadingButton>
                    )}
                    {/*磁力按钮不会出现，因为从rss中解析到的mikan资源都没有磁力链接信息，只有torrent_url*/}
                    {it.magnet && (
                      <LoadingButton
                        className="cursor-pointer"
                        variant={isConnected ? "outline" : "secondary"}
                        size="sm"
                        disabled={isCheckingConnection}
                        loading={
                          isDownloading ? isDownloading(it.magnet!) : false
                        }
                        loadingText="磁力"
                        icon={
                          isConnected ? (
                            <Download className="w-4 h-4" />
                          ) : (
                            <WifiOff className="w-4 h-4 opacity-70" />
                          )
                        }
                        onClick={() => {
                          if (!isConnected) {
                            navigate("/settings");
                          } else {
                            onDownload(it.magnet!, it.title, it);
                          }
                        }}
                      >
                        {isConnected ? "磁力" : "去配置"}
                      </LoadingButton>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
