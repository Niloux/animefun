import { useState, useEffect, useRef } from "react";
import { Anime } from "../types/gen/bangumi";
import { searchSubject, querySubscriptions } from "../lib/api";
import { scoreCandidate, matchTier } from "../lib/utils";
import { Star } from "lucide-react";
import { Input } from "./ui/input";
import { Popover, PopoverTrigger, PopoverContent } from "./ui/popover";
import { Command, CommandList, CommandItem, CommandEmpty } from "./ui/command";
import { Skeleton } from "./ui/skeleton";
import { Badge } from "./ui/badge";
import { useQuery } from "@tanstack/react-query";

interface AutoCompleteProps {
  query: string;
  onQueryChange: (query: string) => void;
  onSelect: (anime: Anime) => void;
  onEnter?: () => void;
  maxSuggestions?: number;
  source?: "global" | "subscriptions";
}

const MIN_QUERY_LEN = 2;

const AutoComplete: React.FC<AutoCompleteProps> = ({
  query,
  onQueryChange,
  onSelect,
  onEnter,
  maxSuggestions = 10,
  source = "global",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [popoverWidth, setPopoverWidth] = useState<number | undefined>(
    undefined,
  );
  const [popoverMaxHeight, setPopoverMaxHeight] = useState<number>(300);

  const queryResult = useQuery({
    queryKey: ["autocomplete", query.trim(), maxSuggestions, source],
    queryFn: async () => {
      const trimmed = query.trim();
      const data =
        source === "subscriptions"
          ? await querySubscriptions({
              keywords: trimmed,
              sort: "match",
              genres: [],
              min_rating: 0,
              max_rating: 10,
              status_code: null,
              limit: 20,
              offset: 0,
            })
          : await searchSubject({
              keywords: trimmed,
              subjectType: [2],
              sort: "match",
              nsfw: false,
              limit: 20,
              offset: 0,
            });
      return data;
    },
    select: (data) => {
      const q = query.trim().toLowerCase();
      return data.data
        .map((a) => ({ a, t: matchTier(q, a), s: scoreCandidate(a) }))
        .sort((x, y) => y.t - x.t || y.s - x.s)
        .slice(0, maxSuggestions)
        .map((x) => x.a);
    },
    enabled: isOpen && !isComposing && query.trim().length >= MIN_QUERY_LEN,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 0,
    placeholderData: (prev) => prev,
  });

  const suggestions = queryResult.data ?? [];
  const isLoading = queryResult.isPending;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
    } else if (e.key === "Enter") {
      if (isComposing) return;
      const canSubmit = query.trim().length > 0;
      setIsOpen(false);
      if (canSubmit) {
        onEnter?.();
      }
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const update = () => {
      const rect = inputRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPopoverWidth(rect.width);
      const avail = window.innerHeight - rect.bottom - 16;
      const mh = Math.max(200, Math.min(avail, 480));
      setPopoverMaxHeight(mh);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [isOpen]);

  return (
    <Popover
      open={isOpen && !isComposing && query.trim().length >= MIN_QUERY_LEN}
      onOpenChange={setIsOpen}
    >
      <PopoverTrigger asChild>
        <Input
          ref={inputRef}
          type="text"
          placeholder="搜索番剧名称..."
          className="border-border"
          value={query}
          onChange={(e) => {
            const v = e.target.value;
            onQueryChange(v);
            setIsOpen(v.trim().length >= MIN_QUERY_LEN);
          }}
          onCompositionStart={() => {
            setIsComposing(true);
          }}
          onCompositionEnd={(e) => {
            setIsComposing(false);
            onQueryChange(e.currentTarget.value);
            setIsOpen(e.currentTarget.value.trim().length >= MIN_QUERY_LEN);
          }}
          onKeyDown={handleKeyDown}
        />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={6}
        className="p-1"
        style={{ width: popoverWidth }}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {isLoading ? (
          <div className="p-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="grid grid-cols-[48px_1fr_auto] items-center gap-3 px-0 py-2"
              >
                <Skeleton className="h-[72px] w-[48px] rounded-2xl" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-3 w-10" />
              </div>
            ))}
          </div>
        ) : suggestions.length > 0 ? (
          <Command>
            <CommandList style={{ maxHeight: popoverMaxHeight }}>
              {suggestions.map((anime) => (
                <CommandItem
                  key={anime.id}
                  className="grid grid-cols-[48px_1fr_auto] items-center gap-3 p-2 cursor-pointer"
                  onSelect={() => {
                    onSelect(anime);
                    setIsOpen(false);
                  }}
                >
                  <img
                    src={
                      anime.images?.small ||
                      "https://lain.bgm.tv/img/no_icon_subject.png"
                    }
                    alt={anime.name}
                    width={48}
                    height={72}
                    className="object-cover rounded-2xl"
                    onError={(e) => {
                      e.currentTarget.src =
                        "https://lain.bgm.tv/img/no_icon_subject.png";
                    }}
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium line-clamp-1 hover:text-primary">
                      {highlight(query, anime.name_cn || anime.name)}
                    </div>
                    {anime.name_cn && anime.name_cn !== anime.name && (
                      <div className="text-xs text-muted-foreground line-clamp-1">
                        {highlight(query, anime.name)}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-yellow-500 flex items-center gap-1">
                      <Star className="h-3 w-3" />
                      {anime.rating?.score
                        ? anime.rating.score.toFixed(1)
                        : "—"}
                    </div>
                    {getYear(anime) && (
                      <Badge
                        variant="outline"
                        className="text-[10px] py-0.5 px-1"
                      >
                        {getYear(anime)}
                      </Badge>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        ) : (
          <Command>
            <CommandEmpty>未找到匹配的结果</CommandEmpty>
          </Command>
        )}
      </PopoverContent>
    </Popover>
  );
};

function highlight(q: string, text: string) {
  const s = q.trim();
  if (!s) return text;
  const i = text.toLowerCase().indexOf(s.toLowerCase());
  if (i < 0) return text;
  const pre = text.slice(0, i);
  const mid = text.slice(i, i + s.length);
  const post = text.slice(i + s.length);
  return (
    <span>
      {pre}
      <span className="bg-primary/10 rounded px-0.5">{mid}</span>
      {post}
    </span>
  );
}

function getYear(a: Anime) {
  const d = a.date || "";
  const y = d.split("-")[0];
  return y || "";
}

export default AutoComplete;
