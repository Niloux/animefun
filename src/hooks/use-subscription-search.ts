import { useMemo, useState } from "react";
import { querySubscriptions } from "../lib/api";
import type { SearchResponse } from "@/types/gen/bangumi";
import { useQuery } from "@tanstack/react-query";
import { useDebouncedValue } from "./use-debounce";

export type SubscriptionSearchFilters = {
  sort: string;
  minRating: number;
  maxRating: number;
  genres: string[];
};

type UseSubscriptionSearchOptions = {
  initialFilters?: SubscriptionSearchFilters;
  limit?: number;
};

type SearchState = {
  keywords: string;
  filters: SubscriptionSearchFilters;
  page: number;
  limit: number;
  submitted: boolean;
};

export const useSubscriptionSearch = (options?: UseSubscriptionSearchOptions) => {
  const { initialFilters = { sort: "heat", minRating: 0, maxRating: 10, genres: [] }, limit = 20 } = options || {};

  const [state, setState] = useState<SearchState>({
    keywords: "",
    filters: initialFilters,
    page: 1,
    limit,
    submitted: false,
  });

  const debouncedKeywords = useDebouncedValue(state.keywords, 400);
  const normalizedGenres = useMemo(() => [...state.filters.genres].sort(), [state.filters.genres]);
  const offset = (Math.max(1, state.page) - 1) * state.limit;

  const query = useQuery<SearchResponse>({
    queryKey: [
      "sub-search",
      {
        sort: state.filters.sort,
        genres: normalizedGenres,
        minRating: state.filters.minRating,
        maxRating: state.filters.maxRating,
        keywords: debouncedKeywords.trim(),
        page: state.page,
        limit: state.limit,
      },
    ],
    queryFn: async () => {
      const data = await querySubscriptions(
        debouncedKeywords.trim(),
        state.filters.sort,
        normalizedGenres,
        state.filters.minRating,
        state.filters.maxRating,
        state.limit,
        offset,
      );
      return data;
    },
    enabled: state.submitted,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
    placeholderData: undefined,
  });

  const setQuery = (v: string) => setState((s) => ({ ...s, keywords: v, submitted: false }));
  const setFilters = (f: SubscriptionSearchFilters) => setState((s) => ({ ...s, filters: f }));
  const setPage = (p: number) => setState((s) => ({ ...s, page: p }));
  const submit = () => setState((s) => ({ ...s, submitted: true, page: 1 }));

  return {
    query: state.keywords,
    setQuery,
    results: state.submitted ? (query.data?.data ?? []) : [],
    total: state.submitted ? (query.data?.total ?? 0) : 0,
    limit: state.limit,
    page: state.page,
    isLoading: state.submitted ? query.isPending : false,
    error: query.error ? (query.error as Error).message : null,
    filters: state.filters,
    setFilters,
    setPage,
    submitted: state.submitted,
    submit,
  };
};