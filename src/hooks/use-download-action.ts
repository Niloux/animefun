import { useCallback, useState } from "react";
import { toast } from "sonner";
import { addTorrentAndTrack } from "../lib/api";
import { Episode } from "../types/gen/bangumi";

interface UseDownloadActionProps {
  subjectId?: number;
  subjectCover?: string;
  episode?: Episode | null;
}

export function useDownloadAction({
  subjectId,
  subjectCover,
  episode,
}: UseDownloadActionProps) {
  const [downloadingUrls, setDownloadingUrls] = useState<Set<string>>(new Set());

  const handleDownload = useCallback(
    async (url: string, title: string, episodeRange: string | null) => {
      if (!subjectId) {
        toast.error("缺少番剧ID，无法下载");
        return;
      }

      // 防止重复点击
      if (downloadingUrls.has(url)) {
        return;
      }

      // 添加到下载中状态
      setDownloadingUrls((prev) => new Set(prev).add(url));

      try {
        const meta = {
          resource_title: title,
          cover_url: subjectCover || "",
        };

        await addTorrentAndTrack(
          url,
          subjectId,
          episode?.sort ? Math.floor(episode.sort) : null,
          episodeRange,
          JSON.stringify(meta),
        );
        toast.success("已添加到下载列表");
      } catch (e) {
        // 正确提取错误消息
        const errorMsg =
          e && typeof e === "object" && "message" in e
            ? String(e.message)
            : String(e);

        // 特殊处理重复下载
        if (
          errorMsg.includes("torrent_already_exists") ||
          errorMsg.includes("该任务已在下载列表中")
        ) {
          toast.warning("该任务已在下载列表中");
        } else {
          toast.error("添加下载失败: " + errorMsg);
        }
      } finally {
        // 从下载中状态移除
        setDownloadingUrls((prev) => {
          const next = new Set(prev);
          next.delete(url);
          return next;
        });
      }
    },
    [subjectId, subjectCover, episode, downloadingUrls],
  );

  const isDownloading = useCallback(
    (url: string) => downloadingUrls.has(url),
    [downloadingUrls],
  );

  return { handleDownload, isDownloading };
}
