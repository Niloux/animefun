import { useCallback } from "react";
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
  const handleDownload = useCallback(
    async (url: string, title: string) => {
      if (!subjectId) {
        toast.error("缺少番剧ID，无法下载");
        return;
      }

      try {
        const meta = {
          resource_title: title,
          cover_url: subjectCover || "",
        };

        await addTorrentAndTrack(
          url,
          subjectId,
          episode?.sort ? Math.floor(episode.sort) : null,
          JSON.stringify(meta),
        );
        toast.success("已添加到下载列表");
      } catch (e) {
        toast.error("添加下载失败: " + String(e));
      }
    },
    [subjectId, subjectCover, episode],
  );

  return { handleDownload };
}
