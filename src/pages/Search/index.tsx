import { useState, useEffect } from "react";
import { AnimeGrid } from "../../components/AnimeGrid";
import { searchSubject } from "../../lib/api";
import { Button } from "../../components/ui/button";
import { Loader2, Filter, X } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Anime } from "../../types/bangumi";
import FiltersPanel from "../../components/FiltersPanel";
import AutoComplete from "../../components/AutoComplete";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../../constants/routes";

const SearchPage = () => {
  const [query, setQuery] = useState<string>("");
  const [results, setResults] = useState<Anime[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [subjectType] = useState<number[]>([2]); // 默认搜索动画类型
  const [isFiltersOpen, setIsFiltersOpen] = useState<boolean>(false);
  const navigate = useNavigate();

  // Filters state
  const [filters, setFilters] = useState({
    sort: "heat",
    minRating: 0,
    maxRating: 10,
    genres: [],
    status: [],
  });

  const handleFilterChange = (newFilters: typeof filters) => {
    setFilters(newFilters);
  };

  const handleApplyFilters = () => {
    handleSearch();
  };

  const handleRemoveFilter = (filterType: string, value: string | number) => {
    if (filterType === "genre") {
      setFilters((prev) => ({
        ...prev,
        genres: prev.genres.filter((g) => g !== value),
      }));
    } else if (filterType === "status") {
      setFilters((prev) => ({
        ...prev,
        status: prev.status.filter((s) => s !== value),
      }));
    } else if (filterType === "minRating") {
      setFilters((prev) => ({ ...prev, minRating: 0 }));
    } else if (filterType === "maxRating") {
      setFilters((prev) => ({ ...prev, maxRating: 10 }));
    }
    // Re-run search with updated filters
    handleSearch();
  };

  const handleSearch = async () => {
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      // Convert filters to API parameters
      const rating =
        filters.minRating > 0 || filters.maxRating < 10
          ? [`>=${filters.minRating}`, `<=${filters.maxRating}`]
          : undefined;

      const data = await searchSubject(
        query.trim(),
        subjectType,
        filters.sort,
        filters.genres.length > 0 ? filters.genres : undefined,
        undefined, // airDate
        rating,
        undefined, // ratingCount
        undefined, // rank
        false,
        20,
        0
      );
      setResults(data.data);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "搜索失败");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <div className="p-4">
      {/* Search Bar */}
      <div className="mb-6 flex gap-2">
        <div className="flex-grow">
          <AutoComplete
            query={query}
            onQueryChange={setQuery}
            onSelect={(anime) => {
              // When a suggestion is selected, navigate to the anime detail page
              navigate(ROUTES.ANIME_DETAIL.replace(":id", anime.id.toString()));
            }}
          />
        </div>
        <Button onClick={handleSearch} disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              搜索中...
            </>
          ) : (
            "搜索"
          )}
        </Button>
        <Button variant="outline" onClick={() => setIsFiltersOpen(true)}>
          <Filter className="mr-2 h-4 w-4" />
          筛选
        </Button>
      </div>

      {/* Active Filters */}
      {(filters.genres.length > 0 ||
        filters.status.length > 0 ||
        filters.minRating > 0 ||
        filters.maxRating < 10) && (
        <div className="mb-4 flex flex-wrap gap-2">
          {filters.genres.map((genre) => (
            <Badge key={genre} variant="secondary" className="flex items-center gap-1">
              {genre}
              <button
                className="ml-1 rounded-full hover:bg-primary/20 p-0.5"
                onClick={() => handleRemoveFilter("genre", genre)}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {filters.status.map((status) => (
            <Badge key={status} variant="secondary" className="flex items-center gap-1">
              {status}
              <button
                className="ml-1 rounded-full hover:bg-primary/20 p-0.5"
                onClick={() => handleRemoveFilter("status", status)}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {filters.minRating > 0 && (
            <Badge variant="secondary" className="flex items-center gap-1">
              评分 ≥ {filters.minRating}
              <button
                className="ml-1 rounded-full hover:bg-primary/20 p-0.5"
                onClick={() => handleRemoveFilter("minRating", filters.minRating)}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.maxRating < 10 && (
            <Badge variant="secondary" className="flex items-center gap-1">
              评分 ≤ {filters.maxRating}
              <button
                className="ml-1 rounded-full hover:bg-primary/20 p-0.5"
                onClick={() => handleRemoveFilter("maxRating", filters.maxRating)}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}

      {/* Search Results */}
      <div className="mb-4">
        {isLoading ? (
          <div className="flex items-center">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            加载中...
          </div>
        ) : error ? (
          <div className="text-red-500">{error}</div>
        ) : total > 0 ? (
          <div className="text-muted-foreground">
            找到 <span className="font-semibold text-foreground">{total}</span> 条结果
          </div>
        ) : query ? (
          <div className="text-muted-foreground">未找到匹配的番剧</div>
        ) : null}
      </div>

      {/* Filters Panel */}
      <FiltersPanel
        open={isFiltersOpen}
        onClose={() => setIsFiltersOpen(false)}
        filters={filters}
        onFilterChange={handleFilterChange}
        onApply={handleApplyFilters}
      />

      {/* Overlay */}
      {isFiltersOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
          onClick={() => setIsFiltersOpen(false)}
        />
      )}

      {/* Anime Cards Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 lg:gap-5">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="bg-card rounded-xl shadow-md overflow-hidden border border-border/60">
              <div className="bg-muted h-60 animate-pulse" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-muted rounded w-3/4 animate-pulse" />
                <div className="h-3 bg-muted rounded w-1/2 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <AnimeGrid items={results} />
      )}
    </div>
  );
};

export default SearchPage;
