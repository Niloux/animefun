import { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';
import { CalendarDay } from '../../types/bangumi';
import { toast } from 'sonner';

const HomePage = () => {
  // 默认选中当天
  const [selectedDay, setSelectedDay] = useState<number>(() => {
    const day = new Date().getDay();
    return day === 0 ? 7 : day;
  });
  const [calendarData, setCalendarData] = useState<CalendarDay[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // 加载日历数据
  const loadData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/calendar.json');

      // 检查响应状态
      if (!response.ok) {
        throw new Error(`加载失败: ${response.statusText}`);
      }

      const data = await response.json();
      setCalendarData(data);
    } catch (error) {
      console.error('加载数据失败:', error);
      // 使用 toast 显示错误信息
      toast.error(
        error instanceof Error ? error.message : '加载数据失败',
        {
          duration: 5000,
          action: {
            label: '重试',
            onClick: () => loadData(),
          },
        }
      );
    } finally {
      setLoading(false);
    }
  };

  // 组件挂载时加载数据
  useEffect(() => {
    loadData();
  }, []);

  // 处理星期几点击
  const handleDayChange = (day: number) => {
    setSelectedDay(day);
  };

  // 获取当前选中天的数据
  const selectedDayData = calendarData.find(
    (day) => day.weekday.id === selectedDay
  );

  const weekDays = [
    { id: 1, name: '星期一', short: '一' },
    { id: 2, name: '星期二', short: '二' },
    { id: 3, name: '星期三', short: '三' },
    { id: 4, name: '星期四', short: '四' },
    { id: 5, name: '星期五', short: '五' },
    { id: 6, name: '星期六', short: '六' },
    { id: 7, name: '星期日', short: '日' },
  ];

  // 计算今天的 id (new Date().getDay() 返回 0-6，需转换为 1-7)
  const todayId = new Date().getDay() === 0 ? 7 : new Date().getDay();

  // 根据评分获取不同颜色
  const getRatingColor = (score: number) => {
    if (score < 5) return 'bg-destructive'; // 红色 - 低分
    if (score < 7) return 'bg-chart-3'; // 黄色 - 中等
    if (score < 9) return 'bg-chart-2'; // 绿色 - 高分
    return 'bg-primary'; // 蓝色 - 顶级评分
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen">加载中...</div>;
  }

  return (
    <div className="p-">
      {/* 头部 */}
      <div className="bg-linear-to-r from-background via-background to-primary/30 backdrop-blur-xl border-b border-border/60 sticky top-0 z-50 w-full shadow-sm mb-6">
        <div className="flex flex-col p-4 gap-4 px-8">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-12 h-12 bg-linear-to-br from-blue-500 via-blue-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-500/30">
                  <Calendar className="w-6 h-6 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-linear-to-r from-gray-900 via-gray-800 to-gray-700 bg-clip-text text-transparent leading-tight">
                  番剧日历
                </h1>
                <div className="text-xs text-muted-foreground font-medium mt-0.5">Anime Calendar</div>
              </div>
            </div>
          </div>

          {/* 星期导航 */}
          <div className="flex items-center gap-1 overflow-x-auto">
            {weekDays.map((day) => (
              <button
                key={day.id}
                onClick={() => handleDayChange(day.id)}
                className={`px-4 py-2 rounded-full cursor-pointer text-sm font-medium transition-all duration-200 min-w-[68px] ${
                  selectedDay === day.id
                    ? 'bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 hover:shadow-xl'
                    : 'bg-card text-card-foreground hover:bg-accent hover:text-accent-foreground border hover:border-accent/50'
                }`}
              >
                {day.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 内容区域 */}
      <main className="w-full max-w-none px-4 sm:px-6 lg:px-8">
        {/* 当天标题 */}
        <div className="flex items-center mb-6">
          <div className={`flex items-center gap-3 ${selectedDay === todayId ? 'text-primary' : 'text-foreground'}`}>
            <div className={`w-1 h-8 rounded-full ${selectedDay === todayId ? 'bg-primary' : 'bg-border'}`} />
            <h2 className="text-2xl font-bold">
              {selectedDayData?.weekday.cn || '未找到数据'}
            </h2>
          </div>
          <div className="flex-1 h-px bg-border ml-3"></div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-card/80 text-card-foreground border border-border/60">
            <Calendar className="w-4 h-4" />
            <span>{selectedDayData?.items.length || 0} 部番剧</span>
          </div>
        </div>

        {/* 番剧卡片网格 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 lg:gap-5">
          {selectedDayData?.items.map((anime) => (
            <div key={anime.id} className="bg-card rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300 border border-border/60 flex flex-col">
              <div className="relative">
                <img
                  src={anime.images.large}
                  alt={anime.name}
                  className="w-full h-60 object-cover"
                  loading="lazy"
                />
                {anime.rating && anime.rating.score !== 0 && (
                  <div className={`absolute top-3 right-3 ${getRatingColor(anime.rating.score)} text-white rounded-full px-2 py-0.5 text-xs font-medium shadow-md`}>
                    {anime.rating.score.toFixed(1)}
                  </div>
                )}
              </div>
              <div className="p-4 flex flex-col grow justify-between">
                <h3 className="text-sm font-semibold line-clamp-2">
                  {anime.name_cn || anime.name}
                </h3>
                {anime.air_date && (
                  <div className="text-xs text-muted-foreground mt-2">
                    {anime.air_date}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default HomePage;
