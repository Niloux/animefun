# AnimeFun 代码审查报告

**审查日期**：2025年12月23日
**审查人**：Code Review Agent (Linus 风格)
**项目版本**：v0.1.0

---

## 【总体评分】

| 层次           | 评分    | 状态                           |
| -------------- | ------- | ------------------------------ |
| **数据结构**   | 🟢 8/10 | 类型系统设计良好，缓存结构简洁 |
| **API 层**     | 🟢 9/10 | 已优化，统一错误处理           |
| **Hooks**      | 🔴 4/10 | 大量重复，过度复杂             |
| **Components** | 🟡 6/10 | 职责混乱，缺少优化             |
| **Pages**      | 🟡 6/10 | 组件过大，重复代码多           |

**总体**：🟢 **7/10** - 架构清晰但充满技术债

---

## 【P0 - 必须立即修复】

### 1. 消除 Hooks 层的代码重复 (~130行可删)

**问题描述**：5个 hook 做完全相同的事情，只是函数名和返回值不同

| Hook                | 当前行数 | 核心差异      |
| ------------------- | -------- | ------------- |
| `useAnimeDetail`    | 34       | 返回 `anime`  |
| `useCalendar`       | 27       | 返回 `data`   |
| `useMikanResources` | 38       | 返回 `data`   |
| `useSubjectStatus`  | 36       | 返回 `status` |

**重复代码模式**：

```typescript
// 这段代码在5个文件中重复出现
const queryClient = useQueryClient();
const query = useQuery<T | null>({
  queryKey: ['xxx', id],
  queryFn: async () => { ... },
  enabled: !!id,
  staleTime: 5 * 60 * 1000,
  gcTime: 10 * 60 * 1000,
  retry: 2,
});
useToastOnError({
  error: query.error,
  onRetry: () => queryClient.refetchQueries(...)
});
return {
  data: query.data ?? null,
  loading: query.isPending,
  error: query.error ? (query.error as Error).message : null,
  reload: query.refetch
};
```

**解决方案**：创建 `src/hooks/use-simple-query.ts`

```typescript
type UseSimpleQueryOptions<T> = {
  queryKey: readonly unknown[];
  queryFn: () => Promise<T | null>;
  enabled?: boolean;
  staleTime?: number;
  gcTime?: number;
  retry?: number;
  errorTitle?: string;
};

export function useSimpleQuery<T>(options: UseSimpleQueryOptions<T>) {
  const queryClient = useQueryClient();

  const query = useQuery<T | null>({
    queryKey: options.queryKey,
    queryFn: options.queryFn,
    enabled: options.enabled ?? true,
    staleTime: options.staleTime ?? 5 * 60 * 1000,
    gcTime: options.gcTime ?? 10 * 60 * 1000,
    retry: options.retry ?? 2,
  });

  useToastOnError({
    error: query.error,
    onRetry: () =>
      queryClient.refetchQueries({ queryKey: options.queryKey, exact: true }),
    title: options.errorTitle ?? "请求失败",
  });

  return {
    data: query.data ?? null,
    loading: query.isPending,
    error: query.error ? (query.error as Error).message : null,
    reload: query.refetch,
  };
}
```

**简化后的示例**：

```typescript
// useAnimeDetail.ts: 34行 → 8行
export const useAnimeDetail = (id: string | undefined) => {
  const { data, ...rest } = useSimpleQuery<Anime>({
    queryKey: ["anime", id],
    queryFn: () => (id ? getAnimeDetail(Number(id)) : Promise.resolve(null)),
    enabled: !!id,
  });
  return { anime: data, ...rest };
};
```

---

### 2. 简化 useEpisodes 的双层分页 (~106行→30行)

**问题描述**：`pageBase` + `subIndex` 双层状态，过度复杂

**当前代码** (`src/hooks/use-episodes.ts`):

```typescript
const PAGE_LIMIT = 18;
const UI_LIMIT = 6;
const SUBS_PER_BASE = PAGE_LIMIT / UI_LIMIT; // 为什么要这样？

const [pageBase, setPageBase] = useState(0); // 页块索引
const [subIndex, setSubIndex] = useState(0); // 块内索引

const jumpToPage = useCallback(
  (page: number) => {
    const lastTotal =
      query.data?.pages?.[query.data.pages.length - 1]?.total ?? 0;
    const tp = Math.ceil(lastTotal / UI_LIMIT);
    if (page >= 0 && page < tp && !query.isFetching) {
      const targetBase = Math.floor(page / SUBS_PER_BASE);
      const targetSub = page % SUBS_PER_BASE;
      setSubIndex(targetSub);
      setPageBase(targetBase);
    }
  },
  [query.data, query.isFetching],
);
```

**问题**：

- 为什么要两层数据缓存？
- `pageBase * 3 + subIndex` 转换毫无意义
- 这是典型的"聪明代码"，但完全没必要

**解决方案**：一次加载全部，本地简单分页

```typescript
export const useEpisodes = (subjectId: number | undefined) => {
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 6;

  const query = useQuery({
    queryKey: ["episodes", subjectId],
    queryFn: async () => {
      if (!subjectId) return [];
      const result = await getEpisodes(subjectId, undefined, 1000, 0);
      // 一次加载全部，本地排序过滤
      return (result.data || [])
        .sort((a, b) => a.disc - b.disc || a.sort - b.sort)
        .filter((e) => e.type === 0 && e.ep !== null)
        .map((e) => ({
          ...e,
          comment_str: e.comment.toLocaleString(),
          duration_display: e.duration || "N/A",
        }));
    },
    staleTime: 5 * 60 * 1000,
  });

  const episodes = query.data ?? [];
  const total = episodes.length;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.min(page, totalPages - 1);
  const start = currentPage * PAGE_SIZE;
  const pageEpisodes = episodes.slice(start, start + PAGE_SIZE);

  const jumpToPage = (p: number) => {
    if (p >= 0 && p < totalPages) setPage(p);
  };

  return {
    episodes: pageEpisodes,
    loading: query.isFetching,
    error: query.error?.message ?? null,
    currentPage,
    totalPages,
    totalEpisodes: total,
    jumpToPage,
    reload: query.refetch,
  };
};
```

---

### 3. 移除 useDownloadList 的手动轮询 (~99行→40行)

**问题描述**：手动 `setInterval` 刷新，应该用 React Query 的 `refetchInterval`

**当前代码** (`src/hooks/use-download-list.ts`):

```typescript
useEffect(() => {
  const timer = window.setInterval(updateLiveInfo, 2000);
  return () => window.clearInterval(timer);
}, [updateLiveInfo]);
```

**解决方案**：

```typescript
export function useDownloadList() {
  const { data: items, refetch } = useQuery({
    queryKey: ["downloads"],
    queryFn: getTrackedDownloads,
    refetchInterval: 2000, // 替代手动轮询
    retry: 3,
  });

  const { data: liveInfo } = useQuery({
    queryKey: ["downloads-live"],
    queryFn: getLiveDownloadInfo,
    refetchInterval: 2000,
    enabled: !!items,
  });

  // 合并数据
  const mergedItems = useMemo(() => {
    if (!items || !liveInfo) return items ?? [];
    return items.map((item) => {
      const live = liveInfo.find((l) => l.hash === item.hash);
      return live ? { ...item, progress: live.progress * 100, ...live } : item;
    });
  }, [items, liveInfo]);

  // 操作函数...
}
```

---

## 【P1 - 技术债，尽快修复】

### 4. 移除 useSubscriptions 的冗余 Set

**问题描述**：同时维护 `items` 和 `idSet`，Set 的 O(1) 优势对几十个项目毫无意义

**当前代码** (`src/hooks/use-subscriptions.ts`):

```typescript
const [items, setItems] = useState<SubscriptionItem[]>([]);
const [idSet, setIdSet] = useState<Set<number>>(new Set());

const isSubscribed = (id: number) => idSet.has(id);
```

**解决方案**：

```typescript
// 移除 idSet，只用 items
const isSubscribed = (id: number) => items.some((x) => x.id === id);
```

---

### 5. 提取通用分页组件

**问题描述**：SearchPage 和 EpisodesList 有重复的分页逻辑

**解决方案**：创建 `src/components/Pagination.tsx`

```typescript
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

export const Pagination = React.memo({
  currentPage, totalPages, onPageChange, disabled
}: PaginationProps) => {
  const pages = visiblePages(totalPages, currentPage + 1);

  return (
    <div className="mt-6">
      <PaginationUI>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              onClick={() => currentPage > 0 && onPageChange(currentPage - 1)}
              disabled={currentPage === 0 || disabled}
            />
          </PaginationItem>
          {pages.map((p, idx) =>
            p === "ellipsis" ? (
              <PaginationEllipsis key={`e-${idx}`} />
            ) : (
              <PaginationLink
                key={p}
                isActive={p === currentPage + 1}
                onClick={() => p - 1 !== currentPage && onPageChange(p - 1)}
              >
                {p}
              </PaginationLink>
            )
          )}
          <PaginationNext
            onClick={() => currentPage + 1 < totalPages && onPageChange(currentPage + 1)}
            disabled={currentPage + 1 >= totalPages || disabled}
          />
        </PaginationContent>
      </PaginationUI>
    </div>
  );
});
```

---

### 6. 修复 AnimeCard 的 React.memo

**问题描述**：`navigate` 函数每次都变，导致 React.memo 失效

**当前代码** (`src/components/AnimeCard.tsx`):

```typescript
export const AnimeCard = React.memo(({ anime, index }: AnimeCardProps) => {
  const navigate = useNavigate();  // 每次都创建新的函数！
```

**解决方案**：

```typescript
export const AnimeCard = React.memo(
  ({ anime }: Omit<AnimeCardProps, "index">) => {
    const navigate = useNavigate();
    // ...
  },
  (prev, next) => {
    // 自定义比较：只比较 anime.id
    return prev.anime.id === next.anime.id;
  },
);
```

---

### 7. 移除 AnimeDetailPage 的内联 ResizeObserver (~50行可删)

**问题描述**：ResizeObserver 逻辑应该放在 hook 或用 CSS

**当前代码** (`src/pages/AnimeDetail/index.tsx:52-65`):

```typescript
useEffect(() => {
  const el = leftPanelRef.current;
  if (!el) return;
  const update = () => {
    const h = el.offsetHeight;
    if (h !== leftPanelHeight) setLeftPanelHeight(h);
  };
  update();
  const ro = new window.ResizeObserver(update);
  ro.observe(el);
  return () => {
    ro.disconnect();
  };
}, [anime, leftPanelHeight]); // 依赖项包含 leftPanelHeight 导致死循环风险
```

**解决方案1**：用 CSS grid

```css
.right-panel {
  display: grid;
  grid-template-rows: min-content 1fr;
  overflow: hidden;
}
```

**解决方案2**：创建 `hooks/useElementSize.ts`

```typescript
export function useElementSize(ref: RefObject<HTMLElement>) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}
```

---

## 【P2 - 优化项】

### 8. 为大列表添加虚拟化

**问题描述**：如果搜索结果有1000条，会渲染1000个组件，浏览器性能问题

**解决方案**：用 `@tanstack/react-virtual` 重写 AnimeGrid

```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

export const AnimeGrid = React.memo(({ items }: AnimeGridProps) => {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 280,  // 卡片高度 + 间距
    overscan: 5,
  });

  return (
    <div ref={parentRef} className="h-[70vh] overflow-auto">
      <div
        style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const anime = items[virtualRow.index];
          return (
            <div
              key={anime.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <AnimeCard anime={anime} />
            </div>
          );
        })}
      </div>
    </div>
  );
});
```

---

### 9. 提取 FilterChips 组件

**问题描述**：SearchPage 有重复的过滤器渲染逻辑

**解决方案**：创建 `src/components/FilterChips.tsx`

```typescript
interface FilterChipsProps {
  filters: {
    genres: string[];
    minRating: number;
    maxRating: number;
  };
  onRemove: (type: string, value: string | number) => void;
}

export const FilterChips = React.memo(({ filters, onRemove }: FilterChipsProps) => {
  const hasFilters = filters.genres.length > 0 ||
                     filters.minRating > 0 ||
                     filters.maxRating < 10;

  if (!hasFilters) return null;

  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {filters.genres.map(genre => (
        <FilterChip key={genre} value={genre} onRemove={() => onRemove("genre", genre)}>
          {genre}
        </FilterChip>
      ))}
      {filters.minRating > 0 && (
        <FilterChip value={filters.minRating} onRemove={() => onRemove("minRating", 0)}>
          评分 ≥ {filters.minRating}
        </FilterChip>
      )}
      {filters.maxRating < 10 && (
        <FilterChip value={filters.maxRating} onRemove={() => onRemove("maxRating", 10)}>
          评分 ≤ {filters.maxRating}
        </FilterChip>
      )}
    </div>
  );
});

const FilterChip = ({ children, value, onRemove }: {
  children: ReactNode;
  value: any;
  onRemove: () => void;
}) => (
  <Badge variant="default" className="flex items-center gap-1">
    {children}
    <button className="ml-1 rounded-full hover:bg-primary/20 p-0.5" onClick={onRemove}>
      <X className="h-3 w-3" />
    </button>
  </Badge>
);
```

---

### 10. 统一错误处理

**问题描述**：有些用 `useToastOnError`，有些用 `console.error`，有些静默失败

| Hook                | 错误处理方式                    | 问题          |
| ------------------- | ------------------------------- | ------------- |
| `useAnimeDetail`    | `useToastOnError`               | ✅ 一致       |
| `useCalendar`       | `useToastOnError`               | ✅ 一致       |
| `useMikanResources` | `useToastOnError`               | ✅ 一致       |
| `useSubjectStatus`  | `useToastOnError`               | ✅ 一致       |
| `useCachedImage`    | `console.error` + 返回 null     | ⚠️ 不一致     |
| `useDownloadList`   | `toast.error` + `console.error` | ⚠️ 重复       |
| `useSubscriptions`  | `console.error`                 | 🔴 静默失败   |
| `useDownloadAction` | `toast.error`                   | ⚠️ 在组件内部 |

**解决方案**：所有 query 用 `useToastOnError`，吞掉的错误要记录日志

---

## 【代码行数预估】

| 模块              | 当前行数  | 优化后    | 减少            |
| ----------------- | --------- | --------- | --------------- |
| `src/hooks/`      | ~800      | ~550      | -250 (-31%)     |
| `src/pages/`      | ~900      | ~600      | -300 (-33%)     |
| `src/components/` | ~600      | ~500      | -100 (-17%)     |
| **总计**          | **~2300** | **~1650** | **-650 (-28%)** |

---

## 【已完成优化】

### API 层优化

- ✅ 创建 `invokeWithErrorHandling` 泛型函数
- ✅ 移除所有重复 try-catch
- ✅ 移除多余 JSDoc 注释
- ✅ `src/lib/api.ts`: 312行 → 75行 (-76%)

### 后端优化

- ✅ 移除 `subscriptions/mod.rs` 中不必要的 `spawn`
- ✅ `src-tauri/src/services/subscriptions/mod.rs`: 77行 → 52行 (-32%)

### 测试通过

- ✅ ESLint: 无错误
- ✅ Rust: 44 tests passed

---

## 【重构路线图】

### 第一阶段：最小改动，快速见效 (1-2天)

1. 修复 `useEpisodes` 的双层分页
2. 修复 `useDownloadList` 的轮询
3. 提取通用分页组件

### 第二阶段：消除重复 (2-3天)

4. 创建 `useSimpleQuery` 统一所有查询 hook
5. 重构 4 个重复的 hook (`useAnimeDetail`, `useCalendar`, 等)
6. 移除 `useSubscriptions` 的冗余 Set

### 第三阶段：组件优化 (3-4天)

7. 提取 `FilterChips`, `JumpPageSelector` 等公共组件
8. 修复 `AnimeCard` 的 React.memo
9. 移除 `AnimeDetailPage` 的 ResizeObserver

### 第四阶段：性能优化 (2-3天)

10. 为 AnimeGrid 添加虚拟化
11. 添加路由级错误边界
12. 统一错误处理机制

---

## 【Linus 总结】

> "这套代码能跑，但距离'好品味'还有距离。
>
> 90% 的 query hook 是复制粘贴的代码——这叫'维护地狱'。`useEpisodes` 那个双层索引的设计是在炫耀数学技巧，不是在解决问题。
>
> 我的建议：写一个 `useSimpleQuery`，删除 130 行重复代码。把轮询改成 `refetchInterval`。移除那个没必要的 `idSet`。
>
> 这些改动能让你在未来 6 个月里少修 50 个 bug。这就是'好品味'的价值。"

---

## 【关键原则】

1. **"好代码没有特殊情况"** - 消除所有 if/else 补丁式代码
2. **"数据结构优先"** - 用正确的数据结构消除逻辑复杂度
3. **"简洁直接"** - 一次加载 + 本地分页 > 双层索引
4. **"不要重复"** - 重复代码是技术债的根源
5. **"实用主义"** - 解决真实问题，而不是过度设计

---

**记住：好品味是一种直觉，需要经验积累。但从消除特殊情况开始。**
