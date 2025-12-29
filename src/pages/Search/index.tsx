import { useState } from "react";
import { AnimeGrid } from "../../components/AnimeGrid";
import { AnimeGridSkeleton } from "../../components/AnimeGridSkeleton";
import { Button } from "../../components/ui/button";
import { Loader2, Filter, X } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import FiltersPanel from "../../components/FiltersPanel";
import AutoComplete from "../../components/AutoComplete";
import { useNavigate } from "react-router-dom";
import { useSearch } from "../../hooks/use-search";
import { PaginationBar } from "../../components/PaginationBar";
import { navigateToAnimeDetail } from "../../lib/utils";

const SearchPage = () => {
  const navigate = useNavigate();
  const {
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
    setPage,
    submit,
    submitted,
  } = useSearch();
  const [isFiltersOpen, setIsFiltersOpen] = useState<boolean>(false);

  const hasActiveFilters =
    filters.genres.length > 0 ||
    filters.minRating > 0 ||
    filters.maxRating < 10;

  const searchMode = submitted && (query.trim().length > 0 || hasActiveFilters);

  const handleFilterChange = (newFilters: typeof filters) => {
    setFilters(newFilters);
  };

  const handleApplyFilters = () => {
    submit();
  };

  const handleRemoveFilter = (filterType: string, value: string | number) => {
    if (filterType === "genre") {
      setFilters({
        ...filters,
        genres: filters.genres.filter((g) => g !== value),
      });
    } else if (filterType === "minRating") {
      setFilters({ ...filters, minRating: 0 });
    } else if (filterType === "maxRating") {
      setFilters({ ...filters, maxRating: 10 });
    }
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="px-4 py-0">
      {/* Search Bar */}
      <div className="mb-6 flex gap-2">
        <div className="grow">
          <AutoComplete
            query={query}
            onQueryChange={setQuery}
            onEnter={() => submit()}
            onSelect={(anime) => {
              navigateToAnimeDetail(navigate, anime.id);
            }}
          />
        </div>
        <Button onClick={() => submit()} disabled={isLoading}>
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
          <Filter className="h-4 w-4" />
          筛选
        </Button>
      </div>

      {/* Active Filters */}
      {(filters.genres.length > 0 ||
        filters.minRating > 0 ||
        filters.maxRating < 10) && (
        <div className="mb-4 flex flex-wrap gap-2">
          {filters.genres.map((genre) => (
            <Badge
              key={genre}
              variant="default"
              className="flex items-center gap-1"
            >
              {genre}
              <button
                className="ml-1 rounded-full hover:bg-primary/20 p-0.5"
                onClick={() => handleRemoveFilter("genre", genre)}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {filters.minRating > 0 && (
            <Badge variant="default" className="flex items-center gap-1">
              评分 ≥ {filters.minRating}
              <button
                className="ml-1 rounded-full hover:bg-primary/20 p-0.5"
                onClick={() =>
                  handleRemoveFilter("minRating", filters.minRating)
                }
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.maxRating < 10 && (
            <Badge variant="default" className="flex items-center gap-1">
              评分 ≤ {filters.maxRating}
              <button
                className="ml-1 rounded-full hover:bg-primary/20 p-0.5"
                onClick={() =>
                  handleRemoveFilter("maxRating", filters.maxRating)
                }
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}

      {/* Search Results */}
      {submitted && (
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
              找到{" "}
              <span className="font-semibold text-foreground">{total}</span>{" "}
              条结果
            </div>
          ) : query ? (
            <div className="text-muted-foreground">未找到匹配的番剧</div>
          ) : null}
        </div>
      )}

      {/* Filters Panel */}
      <FiltersPanel
        open={isFiltersOpen}
        onClose={() => setIsFiltersOpen(false)}
        filters={filters}
        onFilterChange={handleFilterChange}
        onApply={handleApplyFilters}
        hasKeywords={query.trim().length > 0}
      />

      {/* Overlay */}
      {isFiltersOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
          role="button"
          tabIndex={0}
          aria-label="close filters"
          onClick={() => setIsFiltersOpen(false)}
          onKeyDown={(e) => e.key === "Enter" && setIsFiltersOpen(false)}
        />
      )}

      {/* Anime Cards Grid */}
      {submitted &&
        (isLoading ? (
          <AnimeGridSkeleton count={20} />
        ) : (
          <AnimeGrid items={results} />
        ))}

      {/* Pagination */}
      {searchMode && !isLoading && total > limit && (
        <PaginationBar
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          className="mt-6"
        />
      )}
    </div>
  );
};

export default SearchPage;
