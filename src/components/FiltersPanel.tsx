import React from "react";
import { Checkbox } from "./ui/checkbox";
import { Button } from "./ui/button";
import { X } from "lucide-react";

interface FiltersPanelProps {
  open: boolean;
  onClose: () => void;
  filters: {
    sort: string;
    minRating: number;
    maxRating: number;
    genres: string[];
    status: string[];
  };
  onFilterChange: (filters: {
    sort: string;
    minRating: number;
    maxRating: number;
    genres: string[];
    status: string[];
  }) => void;
  onApply: () => void;
}

const FiltersPanel: React.FC<FiltersPanelProps> = ({
  open,
  onClose,
  filters,
  onFilterChange,
  onApply,
}) => {
  // 预设的动画类型
  const animeGenres = [
    "科幻",
    "喜剧",
    "动作",
    "冒险",
    "爱情",
    "奇幻",
    "悬疑",
    "恐怖",
    "校园",
    "日常",
    "治愈",
    "音乐",
    "偶像",
    "历史",
    "战争",
    "运动",
    "美食",
    "机战",
    "魔法",
    "神魔",
  ];

  const animeStatus = ["正在播出", "已完结", "未播出"];

  const handleGenreChange = (genre: string, checked: boolean) => {
    let newGenres = [...filters.genres];
    if (checked) {
      newGenres.push(genre);
    } else {
      newGenres = newGenres.filter((g) => g !== genre);
    }
    onFilterChange({ ...filters, genres: newGenres });
  };

  const handleStatusChange = (status: string, checked: boolean) => {
    let newStatus = [...filters.status];
    if (checked) {
      newStatus.push(status);
    } else {
      newStatus = newStatus.filter((s) => s !== status);
    }
    onFilterChange({ ...filters, status: newStatus });
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({ ...filters, sort: e.target.value });
  };

  const handleMinRatingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ ...filters, minRating: parseFloat(e.target.value) });
  };

  const handleMaxRatingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ ...filters, maxRating: parseFloat(e.target.value) });
  };

  return (
    <div
      className={`fixed right-0 top-0 h-screen w-80 bg-card border-l border-border/60 shadow-xl transform transition-transform duration-300 z-50 ${
        open ? "translate-x-0" : "translate-x-full"
      }`}
    >
      {/* Header */}
      <div className="p-4 flex justify-between items-center border-b border-border/60">
        <h2 className="text-lg font-semibold">筛选条件</h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="p-4 overflow-y-auto h-[calc(100%-6rem)]">
        {/* Sort */}
        <div className="mb-6">
          <h3 className="text-sm font-medium mb-2">排序方式</h3>
          <select
            className="w-full p-2 border border-border/60 rounded-lg bg-card"
            value={filters.sort}
            onChange={handleSortChange}
          >
            <option value="heat">热度</option>
            <option value="rank">排名</option>
            <option value="score">评分</option>
            <option value="match">匹配度</option>
          </select>
        </div>

        {/* Rating Range */}
        <div className="mb-6">
          <h3 className="text-sm font-medium mb-2">评分</h3>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs text-muted-foreground mb-1">
                最低
              </label>
              <input
                type="number"
                min="0"
                max="10"
                step="0.5"
                className="w-full p-2 border border-border/60 rounded-lg bg-card"
                value={filters.minRating}
                onChange={handleMinRatingChange}
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-muted-foreground mb-1">
                最高
              </label>
              <input
                type="number"
                min="0"
                max="10"
                step="0.5"
                className="w-full p-2 border border-border/60 rounded-lg bg-card"
                value={filters.maxRating}
                onChange={handleMaxRatingChange}
              />
            </div>
          </div>
        </div>

        {/* Genres */}
        <div className="mb-6">
          <h3 className="text-sm font-medium mb-2">类型</h3>
          <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
            {animeGenres.map((genre) => (
              <div key={genre} className="flex items-center gap-2">
                <Checkbox
                  id={`genre-${genre}`}
                  checked={filters.genres.includes(genre)}
                  onCheckedChange={(checked) =>
                    handleGenreChange(genre, checked === true)
                  }
                />
                <label
                  htmlFor={`genre-${genre}`}
                  className="text-sm cursor-pointer"
                >
                  {genre}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Status */}
        <div className="mb-6">
          <h3 className="text-sm font-medium mb-2">状态</h3>
          <div className="grid grid-cols-1 gap-2">
            {animeStatus.map((status) => (
              <div key={status} className="flex items-center gap-2">
                <Checkbox
                  id={`status-${status}`}
                  checked={filters.status.includes(status)}
                  onCheckedChange={(checked) =>
                    handleStatusChange(status, checked === true)
                  }
                />
                <label
                  htmlFor={`status-${status}`}
                  className="text-sm cursor-pointer"
                >
                  {status}
                </label>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border/60">
        <Button
          className="w-full"
          onClick={() => {
            onApply();
            onClose();
          }}
        >
          应用筛选
        </Button>
      </div>
    </div>
  );
};

export default FiltersPanel;