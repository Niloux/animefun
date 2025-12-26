import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDebouncedValue } from "./use-debounce";
import type { SearchResponse } from "@/types/gen/bangumi";

type SearchState<TFilters> = {
  keywords: string;
  filters: TFilters;
  page: number;
  limit: number;
  submitted: boolean;
};

export function useSearchCore<TFilters>(options: {
  initialFilters: TFilters;
  limit: number;
  queryKeyBase: string;
  queryKeyExtra?: unknown;
  enablePredicate: (s: SearchState<TFilters>) => boolean;
  queryFn: (ctx: {
    keywords: string;
    debouncedKeywords: string;
    filters: TFilters;
    page: number;
    limit: number;
    offset: number;
  }) => Promise<SearchResponse>;
}) {
  const {
    initialFilters,
    limit,
    queryKeyBase,
    queryKeyExtra,
    enablePredicate,
    queryFn,
  } = options;

  const [state, setState] = useState<SearchState<TFilters>>({
    keywords: "",
    filters: initialFilters,
    page: 1,
    limit,
    submitted: false,
  });

  const debouncedKeywords = useDebouncedValue(state.keywords, 400);
  const offset = (Math.max(1, state.page) - 1) * state.limit;

  const query = useQuery<SearchResponse>({
    queryKey: [
      queryKeyBase,
      {
        filters: state.filters,
        keywords: debouncedKeywords.trim(),
        page: state.page,
        limit: state.limit,
        extra: queryKeyExtra,
      },
    ],
    queryFn: async () =>
      queryFn({
        keywords: state.keywords,
        debouncedKeywords: debouncedKeywords.trim(),
        filters: state.filters,
        page: state.page,
        limit: state.limit,
        offset,
      }),
    enabled: enablePredicate(state),
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
    placeholderData: undefined,
  });

  const setQuery = (v: string) =>
    setState((s) => ({ ...s, keywords: v, submitted: false }));
  const setFilters = (f: TFilters) => setState((s) => ({ ...s, filters: f }));
  const setPage = (p: number) => setState((s) => ({ ...s, page: p }));
  const submit = () => setState((s) => ({ ...s, submitted: true, page: 1 }));

  const hasKeywords = useMemo(
    () => state.keywords.trim().length > 0,
    [state.keywords],
  );

  return {
    query: state.keywords,
    setQuery,
    results: query.data?.data ?? [],
    total: query.data?.total ?? 0,
    limit: state.limit,
    page: state.page,
    isLoading: query.isFetching,
    error: query.error ? (query.error as Error).message : null,
    filters: state.filters,
    setFilters,
    setPage,
    submitted: state.submitted,
    submit,
    hasKeywords,
  };
}
