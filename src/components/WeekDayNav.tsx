import React from "react";
interface WeekDayNavProps {
  selectedDay: number;
  onDayChange: (day: number) => void;
}

// 定义在组件外部，只创建一次
const WEEK_DAYS = [
  { id: 1, name: "星期一", short: "一" },
  { id: 2, name: "星期二", short: "二" },
  { id: 3, name: "星期三", short: "三" },
  { id: 4, name: "星期四", short: "四" },
  { id: 5, name: "星期五", short: "五" },
  { id: 6, name: "星期六", short: "六" },
  { id: 7, name: "星期日", short: "日" },
];

const WeekDayNavBase = ({ selectedDay, onDayChange }: WeekDayNavProps) => {
  return (
    <div className="flex items-center gap-1 overflow-x-auto">
      {WEEK_DAYS.map((day) => (
        <button
          key={day.id}
          onClick={() => onDayChange(day.id)}
          className={`px-4 py-2 rounded-full cursor-pointer text-sm font-medium transition-all duration-300 min-w-[68px] active:scale-95 ${
            selectedDay === day.id
              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 hover:shadow-primary/30"
              : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground hover:shadow-sm"
          }`}
        >
          {day.name}
        </button>
      ))}
    </div>
  );
};

export const WeekDayNav = React.memo(WeekDayNavBase);
