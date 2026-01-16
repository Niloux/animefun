import { Filter, Loader2, X } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimeGrid } from "../../components/AnimeGrid";
import { AnimeGridSkeleton } from "../../components/AnimeGridSkeleton";
import AutoComplete from "../../components/AutoComplete";
import FiltersPanel from "../../components/FiltersPanel";
import { PaginationBar } from "../../components/PaginationBar";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { useSearch } from "../../hooks/use-search";
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
    <div className="py-0">
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
        <Button
          onClick={() => submit()}
          disabled={isLoading}
          className="cursor-pointer"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              搜索中...
            </>
          ) : (
            "搜索"
          )}
        </Button>
        <Button
          variant="outline"
          onClick={() => setIsFiltersOpen(true)}
          className="cursor-pointer"
        >
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
              className="flex items-center gap-1 hover:bg-primary/90 transition-colors"
            >
              {genre}
              <button
                className="ml-1 rounded-full hover:bg-primary-foreground/20 p-0.5 transition-colors cursor-pointer"
                onClick={() => handleRemoveFilter("genre", genre)}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {filters.minRating > 0 && (
            <Badge
              variant="default"
              className="flex items-center gap-1 hover:bg-primary/90 transition-colors"
            >
              评分 ≥ {filters.minRating}
              <button
                className="ml-1 rounded-full hover:bg-primary-foreground/20 p-0.5 transition-colors cursor-pointer"
                onClick={() =>
                  handleRemoveFilter("minRating", filters.minRating)
                }
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.maxRating < 10 && (
            <Badge
              variant="default"
              className="flex items-center gap-1 hover:bg-primary/90 transition-colors"
            >
              评分 ≤ {filters.maxRating}
              <button
                className="ml-1 rounded-full hover:bg-primary-foreground/20 p-0.5 transition-colors cursor-pointer"
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
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground animate-in fade-in-50 bg-muted/5 rounded-xl border border-dashed border-border/50 mx-auto max-w-lg">
              <div className="rounded-full bg-muted/50 p-6 mb-4 shadow-inner">
                <Filter className="h-10 w-10 opacity-40" />
              </div>
              <p className="text-lg font-medium text-foreground/80">未找到匹配的番剧</p>
              <p className="text-sm mt-2 opacity-70 max-w-xs text-center leading-relaxed">
                尝试更换关键词、减少筛选条件，或者换个姿势搜索
              </p>
            </div>
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
