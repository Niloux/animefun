import React from "react";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "./ui/select";
import { Input } from "./ui/input";
import { Slider } from "./ui/slider";
import { ScrollArea } from "./ui/scroll-area";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
} from "./ui/sheet";

interface FiltersPanelProps {
  open: boolean;
  onClose: () => void;
  filters: {
    sort: string;
    minRating: number;
    maxRating: number;
    genres: string[];
  };
  onFilterChange: (filters: {
    sort: string;
    minRating: number;
    maxRating: number;
    genres: string[];
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

  const handleGenresChange = (value: string[]) => {
    onFilterChange({ ...filters, genres: value });
  };

  const handleSortChange = (value: string) => {
    onFilterChange({ ...filters, sort: value });
  };

  const handleMinRatingChange = (value: string) => {
    onFilterChange({ ...filters, minRating: parseFloat(value) });
  };

  const handleMaxRatingChange = (value: string) => {
    onFilterChange({ ...filters, maxRating: parseFloat(value) });
  };

  const handleRatingRangeChange = (values: number[]) => {
    const [min, max] = values;
    onFilterChange({ ...filters, minRating: min, maxRating: max });
  };

  const handleReset = () => {
    onFilterChange({ sort: "heat", minRating: 0, maxRating: 10, genres: [] });
  };

  return (
    <Sheet open={open} onOpenChange={(v) => (v ? undefined : onClose())}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>筛选条件</SheetTitle>
        </SheetHeader>
        <div className="p-4 space-y-6">
          <div className="space-y-2">
            <Label>排序方式</Label>
            <Select value={filters.sort} onValueChange={handleSortChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="选择排序" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="heat">热度</SelectItem>
                <SelectItem value="rank">排名</SelectItem>
                <SelectItem value="score">评分</SelectItem>
                <SelectItem value="match">匹配度</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label>评分</Label>
            <Slider
              value={[filters.minRating, filters.maxRating]}
              min={0}
              max={10}
              step={0.5}
              onValueChange={handleRatingRangeChange}
            />
            <div className="flex gap-4">
              <div className="flex-1 space-y-1">
                <Label htmlFor="minRating">最低</Label>
                <Input
                  id="minRating"
                  type="number"
                  min={0}
                  max={10}
                  step={0.5}
                  value={filters.minRating}
                  onChange={(e) => handleMinRatingChange(e.currentTarget.value)}
                />
              </div>
              <div className="flex-1 space-y-1">
                <Label htmlFor="maxRating">最高</Label>
                <Input
                  id="maxRating"
                  type="number"
                  min={0}
                  max={10}
                  step={0.5}
                  value={filters.maxRating}
                  onChange={(e) => handleMaxRatingChange(e.currentTarget.value)}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>类型</Label>
            <ScrollArea className="h-48">
              <ToggleGroup
                type="multiple"
                value={filters.genres}
                onValueChange={handleGenresChange}
                className="grid grid-cols-5 gap-5"
              >
                {animeGenres.map((genre) => (
                  <ToggleGroupItem
                    key={genre}
                    value={genre}
                    variant="outline"
                    size="sm"
                  >
                    {genre}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </ScrollArea>
          </div>
        </div>
        <SheetFooter>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleReset} className="flex-1">
              重置
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                onApply();
                onClose();
              }}
            >
              应用筛选
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export default FiltersPanel;
