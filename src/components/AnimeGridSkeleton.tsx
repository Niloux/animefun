interface AnimeGridSkeletonProps {
  count?: number;
}

export function AnimeGridSkeleton({ count = 20 }: AnimeGridSkeletonProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 lg:gap-5">
      {Array.from({ length: count }).map((_, i) => (
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
  );
}
