import { useState, useMemo } from "react";
import { Calendar } from "lucide-react";
import { useCalendar } from "../../hooks/use-calendar";
import { PageHeader } from "../../components/PageHeader";
import { WeekDayNav } from "../../components/WeekDayNav";
import { AnimeGrid } from "../../components/AnimeGrid";
import { getWeekdayId } from "../../lib/utils";

const HomePage = () => {
  // 默认选中当天
  const [selectedDay, setSelectedDay] = useState<number>(getWeekdayId);

  // 使用自定义 Hook 加载日历数据
  const { data: calendarData, loading } = useCalendar();

  // 优化数据查找：将数组转换为 ID 映射表，使用 useMemo 缓存结果
  const calendarDataMap = useMemo(() => {
    return calendarData.reduce((map, day) => {
      map[day.weekday.id] = day;
      return map;
    }, {} as Record<number, typeof calendarData[number]>);
  }, [calendarData]);

  // 获取当前选中天的数据 - 现在是 O(1) 时间复杂度
  const selectedDayData = calendarDataMap[selectedDay];

  // 计算今天的 id
  const todayId = getWeekdayId();

  // 处理星期几点击
  const handleDayChange = (day: number) => {
    setSelectedDay(day);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">加载中...</div>
    );
  }

  return (
    <div className="p-4">
      {/* 使用 PageHeader 组件 */}
      <PageHeader
        title="番剧日历"
        description="Anime Calendar"
        icon={Calendar}
      />

      {/* 使用 WeekDayNav 组件 */}
      <div className="px-8">
        <WeekDayNav selectedDay={selectedDay} onDayChange={handleDayChange} />
      </div>

      {/* 内容区域 */}
      <main className="w-full max-w-none px-4 sm:px-6 lg:px-8">
        {/* 当天标题 */}
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
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-card/80 text-card-foreground border border-border/60">
            <Calendar className="w-4 h-4" />
            <span>{selectedDayData?.items.length || 0} 部番剧</span>
          </div>
        </div>

        {/* 使用 AnimeGrid 组件 */}
        <AnimeGrid items={selectedDayData?.items || []} />
      </main>
    </div>
  );
};

export default HomePage;
