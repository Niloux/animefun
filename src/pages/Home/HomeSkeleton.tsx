import { Skeleton } from "../../components/ui/skeleton";
const HomeSkeleton = () => {
  return (
    <>
      <div className="flex items-center mb-6">
        <div className="flex items-center gap-3">
          <Skeleton className="w-1 h-8 rounded-full bg-border" />
          <Skeleton className="h-8 w-32" />
        </div>
        <Skeleton className="flex-1 h-px bg-border ml-3" />
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-card/80 text-card-foreground border border-border/60">
          <Skeleton className="w-4 h-4 rounded-full" />
          <Skeleton className="h-4 w-12" />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 lg:gap-5 transition-opacity duration-300 opacity-100">
        {Array.from({ length: 15 }).map((_, index) => (
          <div
            key={index}
            className="bg-card rounded-xl shadow-md overflow-hidden border border-border/60 flex flex-col"
          >
            <Skeleton className="w-full h-60" />
            <div className="p-4 flex flex-col grow justify-between">
              <Skeleton className="h-4 w-3/4 mb-2" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

export default HomeSkeleton;