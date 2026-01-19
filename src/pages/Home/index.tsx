import { useState } from "react";
import { Calendar, Ghost } from "lucide-react";
import { useCalendar } from "../../hooks/use-calendar";
import { WeekDayNav } from "../../components/WeekDayNav";
import { AnimeGrid } from "../../components/AnimeGrid";
import { getWeekdayId } from "../../lib/utils";
import { Badge } from "../../components/ui/badge";
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
                    className={`w-1 h-8 rounded-full transition-colors duration-300 ${selectedDay === todayId ? "bg-primary shadow-[0_0_8px_rgba(0,0,0,0.2)] dark:shadow-[0_0_12px_rgba(255,255,255,0.2)]" : "bg-border"}`}
                  />
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    {selectedDayData?.weekday.cn || "未找到数据"}
                    {selectedDay === todayId && (
                      <Badge variant="outline" className="text-xs font-normal bg-primary/10 text-primary border-primary/20 animate-pulse">
                        今日
                      </Badge>
                    )}
                  </h2>
                </div>
                <div className="flex-1 h-px bg-border ml-3"></div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground border border-border/50 shadow-sm transition-transform hover:scale-105 cursor-default">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>{selectedDayData?.items.length || 0} 部番剧</span>
                </div>
              </div>
              
              {selectedDayData?.items && selectedDayData.items.length > 0 ? (
                <div key={selectedDay} className="animate-in fade-in slide-in-from-right-8 duration-500 fill-mode-both">
                  <AnimeGrid items={selectedDayData.items} />
                </div>
              ) : (
                <div key={selectedDay} className="flex flex-col items-center justify-center py-24 animate-in zoom-in-95 duration-300">
                  <div className="bg-muted/30 p-8 rounded-full mb-6 ring-1 ring-border/50">
                    <Ghost className="w-16 h-16 text-muted-foreground/40" />
                  </div>
                  <h3 className="text-lg font-medium text-muted-foreground">今天没有更新的番剧哦</h3>
                  <p className="text-sm text-muted-foreground/60 mt-2">去看看其他日期的吧 ~</p>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default HomePage;
