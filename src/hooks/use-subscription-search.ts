import { querySubscriptionsQ } from "../lib/api";
import type { SubjectStatusCode } from "@/types/bangumi";
import { useSearchCore } from "./use-search-core";

export type SubscriptionSearchFilters = {
  sort: string;
  minRating: number;
  maxRating: number;
  genres: string[];
  statusCode?: SubjectStatusCode | null;
};

type UseSubscriptionSearchOptions = {
  initialFilters?: SubscriptionSearchFilters;
  limit?: number;
};

export const useSubscriptionSearch = (options?: UseSubscriptionSearchOptions) => {
  const { initialFilters = { sort: "heat", minRating: 0, maxRating: 10, genres: [], statusCode: null }, limit = 20 } = options || {};

  return useSearchCore<SubscriptionSearchFilters>({
    initialFilters,
    limit,
    queryKeyBase: "sub-search",
    enablePredicate: (s) => s.submitted,
    queryFn: async ({ debouncedKeywords, filters, limit, offset }) => {
      const normalizedGenres = [...filters.genres].sort();
      const data = await querySubscriptionsQ({
        keywords: debouncedKeywords || null,
        sort: filters.sort || null,
        genres: normalizedGenres,
        min_rating: filters.minRating,
        max_rating: filters.maxRating,
        status_code: filters.statusCode ?? null,
        limit,
        offset,
      });
      return data;
    },
  });
};