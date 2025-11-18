import { useState, useCallback } from "react";
import { searchSubject } from "../lib/api";
import { useQuery } from "@tanstack/react-query";

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

export const useSearch = (options?: UseSearchOptions) => {
  const {
    initialFilters = { sort: "heat", minRating: 0, maxRating: 10, genres: [] },
    subjectType = [2],
    limit = 20,
  } = options || {};

  const [query, setQueryState] = useState<string>("");
  const [filters, setFilters] = useState<SearchFilters>(initialFilters);
  const [page, setPage] = useState<number>(1);
  const [requested, setRequested] = useState<boolean>(false);

  const buildRating = (f: SearchFilters): string[] | undefined => {
    if (f.minRating > 0 || f.maxRating < 10) {
      return [
        `>=${f.minRating}`,
        `<=${f.maxRating}`,
      ];
    }
    return undefined;
  };

  const fetchPage = useCallback(
    async (targetPage: number, currentFilters?: SearchFilters) => {
      if (!query.trim()) return;
      const f = currentFilters ?? filters;
      setFilters(f);
      setPage(targetPage);
    },
    [query, filters]
  );

  const search = useCallback(async () => {
    setRequested(true);
    await fetchPage(1, filters);
  }, [fetchPage, filters]);

  const searchWithFilters = useCallback(
    async (nextFilters: SearchFilters) => {
      setRequested(true);
      setFilters(nextFilters);
      if (!query.trim()) {
        return;
      }
      await fetchPage(1, nextFilters);
    },
    [query, fetchPage]
  );

  const applyFilters = useCallback(async () => {
    setRequested(true);
    await fetchPage(1, filters);
  }, [fetchPage, filters]);

  const removeFilter = useCallback(async (filterType: string, value: string | number) => {
    let next = filters;
    if (filterType === "genre") {
      next = { ...filters, genres: filters.genres.filter((g) => g !== value) };
    } else if (filterType === "minRating") {
      next = { ...filters, minRating: 0 };
    } else if (filterType === "maxRating") {
      next = { ...filters, maxRating: 10 };
    }
    await searchWithFilters(next);
  }, [filters, searchWithFilters]);

  const queryResult = useQuery({
    queryKey: [
      'search',
      subjectType,
      filters.sort,
      filters.genres.join(','),
      filters.minRating,
      filters.maxRating,
      query.trim(),
      page,
      limit,
    ],
    queryFn: async () => {
      const rating = buildRating(filters);
      const offset = (Math.max(1, page) - 1) * limit;
      const data = await searchSubject(
        query.trim(),
        subjectType,
        filters.sort,
        filters.genres.length > 0 ? filters.genres : undefined,
        undefined,
        rating,
        undefined,
        undefined,
        false,
        limit,
        offset
      );
      return data;
    },
    enabled: !!query.trim() && requested,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
  });

  const setQuery = useCallback((v: string) => {
    setQueryState(v);
    setRequested(false);
  }, []);


  return {
    query,
    setQuery,
    results: requested && query.trim() ? (queryResult.data?.data ?? []) : [],
    total: requested && query.trim() ? (queryResult.data?.total ?? 0) : 0,
    limit,
    page,
    isLoading: requested && query.trim() ? queryResult.isPending : false,
    error: requested && query.trim() ? (queryResult.error ? (queryResult.error as Error).message : null) : null,
    filters,
    setFilters,
    search,
    fetchPage,
    searchWithFilters,
    applyFilters,
    removeFilter,
  };
};