import { useEffect } from "react";
import { toast } from "sonner";
import { CalendarDay } from "../types/bangumi";
import { getCalendar } from "../lib/api";
import { useQuery } from "@tanstack/react-query";

export function useCalendar() {
  const query = useQuery<CalendarDay[]>({
    queryKey: ['calendar'],
    queryFn: async () => {
      const calendarData = await getCalendar();
      return calendarData;
    },
    staleTime: 60 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
    retry: 2,
  });

  useEffect(() => {
    const e = query.error as unknown;
    if (e) {
      const msg = e instanceof Error ? e.message : '加载数据失败';
      toast.error(msg, {
        duration: 5000,
        action: { label: '重试', onClick: () => query.refetch() },
      });
    }
  }, [query]);

  return { data: query.data ?? [], loading: query.isPending, reload: query.refetch };
}
