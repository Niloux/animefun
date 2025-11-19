import { useMemo, useState } from "react";
import { Button } from "../../components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../../components/ui/alert-dialog";
import { AnimeGrid } from "../../components/AnimeGrid";
import { useSubscriptions } from "../../hooks/use-subscriptions";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../../constants/routes";
import { useSubscriptionSearch } from "../../hooks/use-subscription-search";
import AutoComplete from "../../components/AutoComplete";
import FiltersPanel from "../../components/FiltersPanel";
import { Loader2, Filter, X } from "lucide-react";
import { Badge } from "../../components/ui/badge";

const SubscribePage = () => {
  const navigate = useNavigate();
  const { list, clear } = useSubscriptions();
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
    submitted,
    submit,
  } = useSubscriptionSearch({ limit: 20 });
  const [isFiltersOpen, setIsFiltersOpen] = useState<boolean>(false);

  return (
    <div className="px-4 py-0 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">我的订阅</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate(ROUTES.SEARCH)}>
            去搜索
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={items.length === 0}>
                清空订阅
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认清空订阅？</AlertDialogTitle>
                <AlertDialogDescription>此操作不可撤销，将移除所有订阅。</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction onClick={() => clear()}>确认清空</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="mb-6 flex gap-2">
        <div className="grow">
          <AutoComplete
            query={query}
            onQueryChange={setQuery}
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

      {(filters.genres.length > 0 || filters.minRating > 0 || filters.maxRating < 10 || (filters.statusCode ?? null)) && (
        <div className="mb-4 flex flex-wrap gap-2">
          {filters.genres.map((genre) => (
            <Badge key={genre} variant="default" className="flex items-center gap-1">
              {genre}
              <button
                className="ml-1 rounded-full hover:bg-primary/20 p-0.5"
                onClick={() => {
                  setFilters({ ...filters, genres: filters.genres.filter((g) => g !== genre) });
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
              {(filters.statusCode === "Airing")
                ? "连载中"
                : (filters.statusCode === "Finished")
                ? "已完结"
                : (filters.statusCode === "PreAir")
                ? "未开播"
                : (filters.statusCode === "OnHiatus")
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
          onFilterChange={(f) => setFilters({ ...f, statusCode: f.statusCode ?? null })}
          onApply={() => submit()}
          showStatusFilter
        />
      )}

      {submitted ? (
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
          ) : (
            <div className="text-muted-foreground">未找到匹配的番剧</div>
          )}
        </div>
      ) : null}

      {submitted ? (
        isLoading ? (
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
        )
      ) : items.length === 0 ? (
        <div className="text-muted-foreground">暂无订阅</div>
      ) : (
        <AnimeGrid items={items} />
      )}

      {!isLoading && submitted && total > limit && (
        <div className="mt-6 flex gap-2">
          <Button
            variant="outline"
            disabled={page <= 1}
            onClick={() => {
              if (page > 1) setPage(page - 1);
            }}
          >上一页</Button>
          <Button
            variant="outline"
            disabled={page * limit >= total}
            onClick={() => {
              if (page * limit < total) setPage(page + 1);
            }}
          >下一页</Button>
        </div>
      )}
    </div>
  );
};

export default SubscribePage;
