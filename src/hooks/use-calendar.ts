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

  return { data: query.data ?? [], loading: query.isPending, error: query.error ? (query.error as Error).message : null, reload: query.refetch };
}
