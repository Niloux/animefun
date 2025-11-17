import { useState, useEffect, useRef, useCallback } from "react";
import { searchSubject } from "../lib/api";
import { Anime } from "../types/bangumi";

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

  const [query, setQuery] = useState<string>("");
  const [results, setResults] = useState<Anime[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<SearchFilters>(initialFilters);
  const [page, setPage] = useState<number>(1);

  const reqRef = useRef(0);

  const buildRating = (f: SearchFilters): string[] | undefined => {
    if (f.minRating > 0 || f.maxRating < 10) {
      return [
        `>=${f.minRating}`,
        `<=${f.maxRating}`,
      ];
    }
    return undefined;
  };

  const fetchPage = useCallback(async (targetPage: number) => {
    if (!query.trim()) return;
    setIsLoading(true);
    setError(null);

    const reqId = ++reqRef.current;
    const rating = buildRating(filters);
    const offset = (Math.max(1, targetPage) - 1) * limit;

    try {
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
      if (reqRef.current === reqId) {
        setResults(data.data);
        setTotal(data.total);
        setPage(targetPage);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "搜索失败");
    } finally {
      setIsLoading(false);
    }
  }, [query, filters, subjectType, limit]);

  const search = useCallback(async () => {
    await fetchPage(1);
  }, [fetchPage]);

  const searchWithFilters = useCallback(async (nextFilters: SearchFilters) => {
    setFilters(nextFilters);
    if (!query.trim()) {
      return;
    }
    await fetchPage(1);
  }, [query, fetchPage]);

  const applyFilters = useCallback(async () => {
    await fetchPage(1);
  }, [fetchPage]);

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

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setTotal(0);
      setError(null);
    }
  }, [query]);

  return {
    query,
    setQuery,
    results,
    total,
    limit,
    page,
    isLoading,
    error,
    filters,
    setFilters,
    search,
    fetchPage,
    searchWithFilters,
    applyFilters,
    removeFilter,
  };
};