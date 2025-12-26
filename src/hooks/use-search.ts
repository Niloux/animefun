import { useSearchCore } from "./use-search-core";
import { searchSubject } from "../lib/api";

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

  return useSearchCore<SearchFilters>({
    initialFilters,
    limit,
    queryKeyBase: "search",
    queryKeyExtra: { subjectType },
    enablePredicate: (s) => s.submitted && s.keywords.trim().length > 0,
    queryFn: async ({ debouncedKeywords, filters, limit, offset }) => {
      const normalizedGenres = [...filters.genres].sort();
      const rating =
        filters.minRating > 0 || filters.maxRating < 10
          ? [`>=${filters.minRating}`, `<=${filters.maxRating}`]
          : undefined;
      const data = await searchSubject({
        keywords: debouncedKeywords,
        subjectType,
        sort: filters.sort,
        tag: normalizedGenres.length > 0 ? normalizedGenres : undefined,
        rating,
        nsfw: false,
        limit,
        offset,
      });
      return data;
    },
  });
};
