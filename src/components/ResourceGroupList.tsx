import { FC } from "react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Download } from "lucide-react";
import type { MikanResourceItem } from "../types/gen/mikan";
import { formatBytes } from "../lib/utils";
import { useNavigate } from "react-router-dom";

interface ResourceGroupListProps {
  groups: { group: string; items: MikanResourceItem[] }[];
  onDownload: (url: string, title: string) => void;
  isConnected?: boolean;
  isCheckingConnection?: boolean;
}

export const ResourceGroupList: FC<ResourceGroupListProps> = ({
  groups,
  onDownload,
  isConnected = true,
  isCheckingConnection = false,
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
                      <Button
                        className="cursor-pointer"
                        variant="outline"
                        size="sm"
                        disabled={!isConnected || isCheckingConnection}
                        onClick={() => {
                          if (!isConnected) {
                            navigate("/settings");
                          } else {
                            onDownload(it.torrent_url!, it.title);
                          }
                        }}
                      >
                        <Download className="w-4 h-4 mr-1" />
                        {isCheckingConnection
                          ? "检查中..."
                          : isConnected
                            ? "种子"
                            : "未连接"}
                      </Button>
                    )}
                    {it.magnet && (
                      <Button
                        className="cursor-pointer"
                        variant="outline"
                        size="sm"
                        disabled={!isConnected || isCheckingConnection}
                        onClick={() => {
                          if (!isConnected) {
                            navigate("/settings");
                          } else {
                            onDownload(it.magnet!, it.title);
                          }
                        }}
                      >
                        <Download className="w-4 h-4 mr-1" />
                        {isCheckingConnection
                          ? "检查中..."
                          : isConnected
                            ? "磁力"
                            : "未连接"}
                      </Button>
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
