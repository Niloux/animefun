import { CalendarDay } from "../types/bangumi";
import { getCalendar } from "../lib/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";

export function useCalendar() {
  const queryClient = useQueryClient();
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
    if (query.error) {
      const msg = (query.error as Error).message;
      toast.error(msg, { duration: 5000, action: { label: '重试', onClick: () => queryClient.refetchQueries({ queryKey: ['calendar'], exact: true }) } });
    }
  }, [query.error, queryClient]);

  return { data: query.data ?? [], loading: query.isPending, error: query.error ? (query.error as Error).message : null, reload: query.refetch };
}
