import { useMemo, useState } from "react";
import { searchSubject } from "../lib/api";
import { useQuery } from "@tanstack/react-query";
import { Anime } from "../types/bangumi";
import { useDebouncedValue } from "./use-debounce";

export type SearchFilters = {
  sort: string;
  minRating: number;
  maxRating: number;
  genres: string[];
};

type UseSearchOptions = {
  initialFilters?: SearchFilters;
  subjectType?: number[];
  limit?: number;
};

type SearchState = {
  keywords: string;
  filters: SearchFilters;
  page: number;
  subjectType: number[];
  limit: number;
  submitted: boolean;
};

export const useSearch = (options?: UseSearchOptions) => {
  const {
    initialFilters = { sort: "heat", minRating: 0, maxRating: 10, genres: [] },
    subjectType = [2],
    limit = 20,
  } = options || {};

  const [state, setState] = useState<SearchState>({
    keywords: "",
    filters: initialFilters,
    page: 1,
    subjectType,
    limit,
    submitted: false,
  });

  const debouncedKeywords = useDebouncedValue(state.keywords, 400);
  const hasKeywords = state.keywords.trim().length > 0;
  const normalizedGenres = useMemo(() => [...state.filters.genres].sort(), [state.filters.genres]);
  const rating = useMemo(() => {
    if (state.filters.minRating > 0 || state.filters.maxRating < 10) {
      return [`>=${state.filters.minRating}`, `<=${state.filters.maxRating}`];
    }
    return undefined;
  }, [state.filters.minRating, state.filters.maxRating]);
  const offset = (Math.max(1, state.page) - 1) * state.limit;

  const query = useQuery<{ total: number; limit: number; offset: number; data: Anime[] }>({
    queryKey: [
      "search",
      {
        subjectType: state.subjectType,
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
      const data = await searchSubject(
        debouncedKeywords.trim(),
        state.subjectType,
        state.filters.sort,
        normalizedGenres.length > 0 ? normalizedGenres : undefined,
        undefined,
        rating,
        undefined,
        undefined,
        false,
        state.limit,
        offset
      );
      return data;
    },
    enabled: hasKeywords && state.submitted,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
    placeholderData: undefined,
  });

  const setQuery = (v: string) => setState((s) => ({ ...s, keywords: v, submitted: false }));
  const setFilters = (f: SearchFilters) => setState((s) => ({ ...s, filters: f }));
  const setPage = (p: number) => setState((s) => ({ ...s, page: p }));
  const submit = () => setState((s) => ({ ...s, submitted: true, page: 1 }));

  return {
    query: state.keywords,
    setQuery,
    results: state.submitted && hasKeywords ? (query.data?.data ?? []) : [],
    total: state.submitted && hasKeywords ? (query.data?.total ?? 0) : 0,
    limit: state.limit,
    page: state.page,
    isLoading: state.submitted && hasKeywords ? query.isPending : false,
    error: query.error ? (query.error as Error).message : null,
    filters: state.filters,
    setFilters,
    setPage,
    submitted: state.submitted,
    submit,
  };
};