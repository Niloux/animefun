import { useState } from "react";
import { Calendar } from "lucide-react";
import { useCalendar } from "../../hooks/use-calendar";
import { WeekDayNav } from "../../components/WeekDayNav";
import { AnimeGrid } from "../../components/AnimeGrid";
import { getWeekdayId } from "../../lib/utils";
import HomeSkeleton from "./HomeSkeleton";

const HomePage = () => {
  // 默认选中当天
  const [selectedDay, setSelectedDay] = useState<number>(getWeekdayId);

  // 使用自定义 Hook 加载日历数据
  const { data: calendarData, loading } = useCalendar();

  // 直接查找选中日期数据（日历数据按星期几有序，查找效率高）
  const selectedDayData = calendarData.find(
    (day) => day.weekday.id === selectedDay
  );

  // 计算今天的 id
  const todayId = getWeekdayId();

  // 处理星期几点击
  const handleDayChange = (day: number) => {
    setSelectedDay(day);
  };

  // loading handled in main conditional

  return (
    <div className="p-0">
      {/* 使用 WeekDayNav 组件 */}
      <div className="py-0">
        <WeekDayNav selectedDay={selectedDay} onDayChange={handleDayChange} />
      </div>

      {/* 内容区域 */}
      <div className="py-8">
        <main className="w-full max-w-none">
          {loading ? (
            <HomeSkeleton />
          ) : (
            <>
              <div className="flex items-center mb-6">
                <div
                  className={`flex items-center gap-3 ${selectedDay === todayId ? "text-primary" : "text-foreground"}`}
                >
                  <div
                    className={`w-1 h-8 rounded-full ${selectedDay === todayId ? "bg-primary" : "bg-border"}`}
                  />
                  <h2 className="text-2xl font-bold">
                    {selectedDayData?.weekday.cn || "未找到数据"}
                  </h2>
                </div>
                <div className="flex-1 h-px bg-border ml-3"></div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground border border-border/50 shadow-sm">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>{selectedDayData?.items.length || 0} 部番剧</span>
                </div>
              </div>
              <AnimeGrid items={selectedDayData?.items || []} />
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default HomePage;
