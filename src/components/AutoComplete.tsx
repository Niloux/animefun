import { useState, useEffect, useRef } from "react";
import { Anime } from "../types/bangumi";
import { searchSubject } from "../lib/api";
import { Loader2 } from "lucide-react";

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
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: unknown) => {
      const target = (event as { target: unknown }).target as unknown;
      if (dropdownRef.current && !dropdownRef.current.contains(target as never)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Fetch suggestions when query changes and is longer than 2 characters
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (query.trim().length < 2) {
        setSuggestions([]);
        return;
      }

      setIsLoading(true);
      setIsOpen(true);

      try {
        const data = await searchSubject(query.trim(), [2], "match", undefined, undefined, undefined, undefined, undefined, false, 10, 0);
        setSuggestions(data.data);
      } catch (err) {
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    };

    // Debounce fetch to avoid too many API calls
    const timer = window.setTimeout(() => {
      fetchSuggestions();
    }, 300);

    return () => window.clearTimeout(timer);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
    } else if (e.key === "Escape") {
      setIsOpen(false);
    } else if (e.key === "Enter") {
      setIsOpen(false);
      onEnter?.();
    }
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <input
        type="text"
        placeholder="搜索番剧名称..."
        value={query}
        onChange={(e) => {
          onQueryChange(e.target.value);
          setIsOpen(true);
        }}
        onKeyDown={handleKeyDown}
        className="w-full p-3 border border-border/60 rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
      />

      {isOpen && (query.trim().length >= 2) && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border/60 rounded-lg shadow-xl z-50 overflow-hidden">
          {isLoading ? (
            <div className="p-4 flex items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="ml-2 text-sm text-muted-foreground">加载中...</span>
            </div>
          ) : suggestions.length > 0 ? (
            <ul>
              {suggestions.map((anime) => (
                <li key={anime.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(anime);
                      setIsOpen(false);
                    }}
                    className="w-full p-3 hover:bg-muted transition-colors flex gap-3 text-left"
                  >
                    <img
                      src={anime.images?.small || "https://lain.bgm.tv/img/no_icon_subject.png"}
                      alt={anime.name}
                      width={40}
                      height={60}
                      className="object-cover rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium line-clamp-1 hover:text-primary">
                        {anime.name_cn || anime.name}
                      </h3>
                      {anime.name_cn && anime.name_cn !== anime.name && (
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {anime.name}
                        </p>
                      )}
                      {anime.rating && anime.rating.score !== 0 && (
                        <span className="text-xs text-yellow-500 mt-1">
                          ⭐ {anime.rating.score.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-4 text-sm text-muted-foreground">
              未找到匹配的结果
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AutoComplete;