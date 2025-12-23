import { useMemo, useState } from "react";
import { Button } from "../../components/ui/button";
import { AnimeGrid } from "../../components/AnimeGrid";
import { useSubscriptions } from "../../hooks/use-subscriptions";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../../constants/routes";
import { useSubscriptionSearch } from "../../hooks/use-subscription-search";
import AutoComplete from "../../components/AutoComplete";
import FiltersPanel from "../../components/FiltersPanel";
import { Loader2, Filter, X } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { PaginationBar } from "../../components/PaginationBar";
import { sortAnimeList } from "@/lib/utils";

const SubscribePage = () => {
  const navigate = useNavigate();
  const { list } = useSubscriptions();
  const items = useMemo(() => list, [list]);
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
    hasKeywords,
    submitted,
  } = useSubscriptionSearch({ limit: 20 });
  const [isFiltersOpen, setIsFiltersOpen] = useState<boolean>(false);
  const [listPage, setListPage] = useState<number>(1);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const totalListPages = Math.max(1, Math.ceil(items.length / limit));
  const safeListPage = Math.min(listPage, totalListPages);

  const hasActiveFilters =
    filters.genres.length > 0 ||
    filters.minRating > 0 ||
    filters.maxRating < 10 ||
    !!(filters.statusCode ?? null);
  const searchMode = submitted && (hasKeywords || hasActiveFilters);

  const sortedItems = useMemo(
    () => sortAnimeList(items, filters.sort),
    [items, filters.sort]
  );

  return (
    <div className="px-4 py-0 space-y-4">
      <div className="mb-6 flex gap-2">
        <div className="grow">
          <AutoComplete
            query={query}
            onQueryChange={(v) => {
              setQuery(v);
              setPage(1);
            }}
            onEnter={() => submit()}
            onSelect={(anime) => {
              navigate(ROUTES.ANIME_DETAIL.replace(":id", anime.id.toString()));
            }}
            source="subscriptions"
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

      {(filters.genres.length > 0 ||
        filters.minRating > 0 ||
        filters.maxRating < 10 ||
        (filters.statusCode ?? null)) && (
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
                onClick={() => {
                  setFilters({
                    ...filters,
                    genres: filters.genres.filter((g) => g !== genre),
                  });
                  setPage(1);
                }}
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
                onClick={() => {
                  setFilters({ ...filters, minRating: 0 });
                  setPage(1);
                }}
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
                onClick={() => {
                  setFilters({ ...filters, maxRating: 10 });
                  setPage(1);
                }}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {(filters.statusCode ?? null) && (
            <Badge variant="default" className="flex items-center gap-1">
              {filters.statusCode === "Airing"
                ? "连载中"
                : filters.statusCode === "Finished"
                  ? "已完结"
                  : filters.statusCode === "PreAir"
                    ? "未开播"
                    : filters.statusCode === "OnHiatus"
                      ? "停更"
                      : "未知"}
              <button
                className="ml-1 rounded-full hover:bg-primary/20 p-0.5"
                onClick={() => {
                  setFilters({ ...filters, statusCode: null });
                  setPage(1);
                }}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}

      {isFiltersOpen && (
        <FiltersPanel
          open={isFiltersOpen}
          onClose={() => setIsFiltersOpen(false)}
          filters={filters}
          onFilterChange={(f) => {
            setFilters({ ...f, statusCode: f.statusCode ?? null });
            setPage(1);
          }}
          onApply={() => submit()}
          showStatusFilter
          hasKeywords={hasKeywords}
        />
      )}

      {searchMode ? (
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
          ) : (
            <div className="text-muted-foreground">未找到匹配的番剧</div>
          )}
        </div>
      ) : null}

      {searchMode ? (
        isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 lg:gap-5">
            {Array.from({ length: limit }).map((_, i) => (
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
        )
      ) : items.length === 0 ? (
        <div className="text-muted-foreground">暂无订阅</div>
      ) : (
        <AnimeGrid
          items={sortedItems.slice(
            (safeListPage - 1) * limit,
            safeListPage * limit
          )}
        />
      )}

      {searchMode && !isLoading && total > limit && (
        <PaginationBar
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          className="mt-6"
        />
      )}

      {!searchMode && items.length > limit && (
        <PaginationBar
          currentPage={safeListPage}
          totalPages={totalListPages}
          onPageChange={setListPage}
          className="mt-6"
        />
      )}
    </div>
  );
};

export default SubscribePage;
