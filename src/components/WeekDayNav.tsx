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

export const WeekDayNav = ({ selectedDay, onDayChange }: WeekDayNavProps) => {
  return (
    // 星期导航
    <div className="flex items-center gap-1 overflow-x-auto">
      {WEEK_DAYS.map((day) => (
        <button
          key={day.id}
          onClick={() => onDayChange(day.id)}
          className={`px-4 py-2 rounded-full cursor-pointer text-sm font-medium transition-all duration-200 min-w-[68px] ${
            selectedDay === day.id
              ? "bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 hover:shadow-xl"
              : "bg-card text-card-foreground hover:bg-accent hover:text-accent-foreground border hover:border-accent/50"
          }`}
        >
          {day.name}
        </button>
      ))}
    </div>
  );
};
