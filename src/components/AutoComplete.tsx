import { useState, useEffect, useRef } from "react";
import { Anime } from "../types/bangumi";
import { searchSubject } from "../lib/api";
import { scoreCandidate } from "../lib/utils";
import { Loader2, Star } from "lucide-react";
import { Input } from "./ui/input";
import { Popover, PopoverTrigger, PopoverContent } from "./ui/popover";
import { Command, CommandList, CommandItem, CommandEmpty } from "./ui/command";

interface AutoCompleteProps {
  query: string;
  onQueryChange: (query: string) => void;
  onSelect: (anime: Anime) => void;
  onEnter?: () => void;
}

const AutoComplete: React.FC<AutoCompleteProps> = ({
  query,
  onQueryChange,
  onSelect,
  onEnter,
}) => {
  const [suggestions, setSuggestions] = useState<Anime[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const requestRef = useRef(0);
  const composingRef = useRef(false);

  // Fetch suggestions when query changes and is longer than 2 characters
  useEffect(() => {
    const fetchSuggestions = async () => {
      const trimmed = query.trim();
      if (composingRef.current) {
        return;
      }
      if (trimmed.length < 22) {
        setSuggestions([]);
        setIsLoading(false);
        setIsOpen(false);
        return;
      }

      const current = requestRef.current + 1;
      requestRef.current = current;
      setIsLoading(true);

      try {
        const data = await searchSubject(
          trimmed,
          [2],
          "match",
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          false,
          20,
          0
        );
        if (current === requestRef.current) {
          const q = trimmed.toLowerCase();
          const scored = data.data
            .map((a) => ({ a, s: scoreCandidate(q, a) }))
            .sort((x, y) => y.s - x.s)
            .slice(0, 5)
            .map((x) => x.a);
          setSuggestions(scored);
        }
      } catch {
        if (current === requestRef.current) {
          setSuggestions([]);
        }
      } finally {
        if (current === requestRef.current) {
          setIsLoading(false);
        }
      }
    };

    const timer = window.setTimeout(() => {
      fetchSuggestions();
    }, 300);

    return () => window.clearTimeout(timer);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
    } else if (e.key === "Enter") {
      if (composingRef.current) return;
      setIsOpen(false);
      onEnter?.();
    }
  };

  return (
    <Popover open={isOpen && query.trim().length >= 2} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Input
          type="text"
          placeholder="搜索番剧名称..."
          value={query}
          onChange={(e) => {
            const v = e.target.value;
            onQueryChange(v);
            setIsOpen(v.trim().length >= 2);
          }}
          onCompositionStart={() => {
            composingRef.current = true;
          }}
          onCompositionEnd={(e) => {
            composingRef.current = false;
            onQueryChange(e.currentTarget.value);
            setIsOpen(e.currentTarget.value.trim().length >= 2);
          }}
          onKeyDown={handleKeyDown}
        />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="p-0 w-80"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {isLoading ? (
          <div className="p-4 flex items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="ml-2 text-sm text-muted-foreground">
              加载中...
            </span>
          </div>
        ) : suggestions.length > 0 ? (
          <Command>
            <CommandList>
              {suggestions.map((anime) => (
                <CommandItem
                  key={anime.id}
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
                    width={40}
                    height={60}
                    className="object-cover rounded"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium line-clamp-1 hover:text-primary">
                      {anime.name_cn || anime.name}
                    </div>
                    {anime.name_cn && anime.name_cn !== anime.name && (
                      <div className="text-xs text-muted-foreground line-clamp-1">
                        {anime.name}
                      </div>
                    )}
                    {anime.rating && anime.rating.score !== 0 && (
                      <div className="text-xs text-yellow-500 mt-1 flex items-center gap-1">
                        <Star className="h-3 w-3" />{" "}
                        {anime.rating.score.toFixed(1)}
                      </div>
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

export default AutoComplete;
