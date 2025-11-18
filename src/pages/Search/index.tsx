import { useState } from "react";
import { AnimeGrid } from "../../components/AnimeGrid";
import { Button } from "../../components/ui/button";
import { Loader2, Filter, X } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import FiltersPanel from "../../components/FiltersPanel";
import AutoComplete from "../../components/AutoComplete";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../../constants/routes";
import { useSearch } from "../../hooks/use-search";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from "../../components/ui/pagination";

const SearchPage = () => {
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
    search,
    fetchPage,
    applyFilters,
    removeFilter,
  } = useSearch({ subjectType: [2], limit: 20 });
  const [isFiltersOpen, setIsFiltersOpen] = useState<boolean>(false);
  const navigate = useNavigate();

  const handleFilterChange = (newFilters: typeof filters) => {
    setFilters(newFilters);
  };

  const handleApplyFilters = () => {
    applyFilters();
  };

  const handleRemoveFilter = (filterType: string, value: string | number) => {
    removeFilter(filterType, value);
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const getVisiblePages = (): (number | "ellipsis")[] => {
    const current = page;
    const pages: (number | "ellipsis")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      return pages;
    }
    pages.push(1);
    if (current > 3) pages.push("ellipsis");
    const start = Math.max(2, current - 1);
    const end = Math.min(totalPages - 1, current + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (current < totalPages - 2) pages.push("ellipsis");
    pages.push(totalPages);
    return pages;
  };

  return (
    <div className="p-4">
      {/* Search Bar */}
      <div className="mb-6 flex gap-2">
        <div className="grow">
          <AutoComplete
            query={query}
            onQueryChange={setQuery}
            onEnter={search}
            onSelect={(anime) => {
              // When a suggestion is selected, navigate to the anime detail page
              navigate(ROUTES.ANIME_DETAIL.replace(":id", anime.id.toString()));
            }}
          />
        </div>
        <Button onClick={search} disabled={isLoading}>
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
            <Badge variant="secondary" className="flex items-center gap-1">
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
            <Badge variant="secondary" className="flex items-center gap-1">
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
            找到 <span className="font-semibold text-foreground">{total}</span>{" "}
            条结果
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
          role="button"
          tabIndex={0}
          aria-label="close filters"
          onClick={() => setIsFiltersOpen(false)}
          onKeyDown={(e) => e.key === "Enter" && setIsFiltersOpen(false)}
        />
      )}

      {/* Anime Cards Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 lg:gap-5">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="bg-card rounded-xl shadow-md overflow-hidden border border-border/60"
            >
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

      {/* Pagination */}
      {!isLoading && total > limit && (
        <div className="mt-6">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  className={
                    page === 1 ? "pointer-events-none opacity-50" : undefined
                  }
                  onClick={(e) => {
                    e.preventDefault();
                    if (page > 1) fetchPage(page - 1);
                  }}
                />
              </PaginationItem>
              {getVisiblePages().map((p, idx) =>
                p === "ellipsis" ? (
                  <PaginationItem key={`e-${idx}`}>
                    <PaginationEllipsis />
                  </PaginationItem>
                ) : (
                  <PaginationItem key={p}>
                    <PaginationLink
                      href="#"
                      isActive={p === page}
                      onClick={(e) => {
                        e.preventDefault();
                        if (p !== page) fetchPage(p);
                      }}
                    >
                      {p}
                    </PaginationLink>
                  </PaginationItem>
                )
              )}
              <PaginationItem>
                <PaginationNext
                  href="#"
                  className={
                    page >= totalPages
                      ? "pointer-events-none opacity-50"
                      : undefined
                  }
                  onClick={(e) => {
                    e.preventDefault();
                    if (page < totalPages) fetchPage(page + 1);
                  }}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
};

export default SearchPage;
