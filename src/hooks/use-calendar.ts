import { CalendarDay } from "../types/bangumi";
import { getCalendar } from "../lib/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToastOnError } from "./use-toast-on-error";

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

  // 使用统一的错误提示钩子
  useToastOnError({
    error: query.error,
    onRetry: () => queryClient.refetchQueries({ queryKey: ['calendar'], exact: true })
  });

  return { data: query.data ?? [], loading: query.isPending, error: query.error ? (query.error as Error).message : null, reload: query.refetch };
}
