import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { getEpisodes } from '../lib/api';
import { Episode } from '../types/bangumi';

export const useEpisodes = (subjectId: number | undefined) => {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!subjectId) {
      setEpisodes([]);
      setLoading(false);
      setError(null);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const result = await getEpisodes(subjectId, undefined, 100, 0);
      const list = (result.data || [])
        .sort((a, b) => a.disc - b.disc || a.sort - b.sort)
        .filter(e => e.type === 0 && e.ep !== null)
        .map(e => ({
          ...e,
          comment_str: e.comment.toLocaleString(),
          duration_display: e.duration || 'N/A',
        }));
      setEpisodes(list);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '加载剧集失败';
      setError(msg);
      setEpisodes([]);
      toast.error(msg, { duration: 5000, action: { label: '重试', onClick: () => loadData() } });
    } finally {
      setLoading(false);
    }
  }, [subjectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return { episodes, loading, error, reload: loadData };
};