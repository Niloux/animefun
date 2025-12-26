import { CalendarDay } from "../types/gen/bangumi";
import { getCalendar } from "../lib/api";
import { useSimpleQuery } from "./use-simple-query";

export function useCalendar() {
  const { data, loading, error, reload } = useSimpleQuery<CalendarDay[]>({
    queryKey: ["calendar"],
    queryFn: getCalendar,
    staleTime: 60 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
  });

  return {
    data: data ?? [],
    loading,
    error,
    reload,
  };
}
