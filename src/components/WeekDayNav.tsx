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
    <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide mask-linear-fade">
      {WEEK_DAYS.map((day) => (
        <button
          key={day.id}
          onClick={() => onDayChange(day.id)}
          className={`relative overflow-hidden px-5 py-2.5 rounded-2xl cursor-pointer text-sm font-medium transition-all duration-300 min-w-[72px] active:scale-95 group ${
            selectedDay === day.id
              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 scale-[1.02]"
              : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground hover:shadow-md hover:-translate-y-0.5"
          }`}
        >
          {selectedDay === day.id && (
            <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%)] bg-size-[250%_250%] animate-[shimmer_2s_linear_infinite]" />
          )}
          <span className="relative z-10">{day.name}</span>
        </button>
      ))}
    </div>
  );
};

export const WeekDayNav = React.memo(WeekDayNavBase);
