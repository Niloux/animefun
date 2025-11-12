import { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';

interface Weekday {
  en: string;
  cn: string;
  ja: string;
  id: number;
}

interface Anime {
  id: number;
  url: string;
  type: number;
  name: string;
  name_cn: string;
  summary: string;
  air_date: string;
  air_weekday: number;
  rating: {
    total: number;
    count: { [key: string]: number };
    score: number;
  };
  rank?: number;
  images: {
    large: string;
    common: string;
    medium: string;
    small: string;
    grid: string;
  };
  collection?: {
    doing: number;
  };
}

interface CalendarDay {
  weekday: Weekday;
  items: Anime[];
}

const HomePage = () => {
  // 默认选中当天
  const [selectedDay, setSelectedDay] = useState<number>(() => {
    const day = new Date().getDay();
    return day === 0 ? 7 : day;
  });
  const [calendarData, setCalendarData] = useState<CalendarDay[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // 加载日历数据
  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch('/calendar.json');
        const data = await response.json();
        setCalendarData(data);
        setLoading(false);
      } catch (error) {
        console.error('加载数据失败:', error);
        setLoading(false);
      }
    };

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
    if (score < 5) return 'bg-red-500';
    if (score < 7) return 'bg-yellow-500';
    if (score < 9) return 'bg-green-500';
    return 'bg-blue-500';
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen">加载中...</div>;
  }

  return (
    <div className="p-">
      {/* 头部 */}
      <div className="bg-gradient-to-r from-white via-white to-blue-50/30 backdrop-blur-xl border-b border-gray-200/60 sticky top-0 z-50 w-full shadow-sm mb-6">
        <div className="flex flex-col p-4 gap-4 px-8">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 via-blue-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-500/30">
                  <Calendar className="w-6 h-6 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-700 bg-clip-text text-transparent leading-tight">
                  番剧日历
                </h1>
                <div className="text-xs text-gray-500 font-medium mt-0.5">Anime Calendar</div>
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
                    ? 'bg-blue-500 text-white shadow-lg hover:bg-blue-600 hover:shadow-xl'
                    : 'bg-white text-gray-600 hover:bg-blue-50 hover:text-blue-600 border hover:border-blue-200'
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
          <div className={`flex items-center gap-3 ${selectedDay === todayId ? 'text-blue-700' : 'text-slate-700'}`}>
            <div className={`w-1 h-8 rounded-full ${selectedDay === todayId ? 'bg-blue-500' : 'bg-slate-300'}`} />
            <h2 className="text-2xl font-bold">
              {selectedDayData?.weekday.cn || '未找到数据'}
            </h2>
          </div>
          <div className="flex-1 h-px bg-gray-200 ml-3"></div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-slate-100/80 text-slate-600 border border-slate-200/60">
            <Calendar className="w-4 h-4" />
            <span>{selectedDayData?.items.length || 0} 部番剧</span>
          </div>
        </div>

        {/* 番剧卡片网格 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 lg:gap-5">
          {selectedDayData?.items.map((anime) => (
            <div key={anime.id} className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300 border border-gray-200/60">
              <div className="relative">
                <img
                  src={anime.images.large}
                  alt={anime.name}
                  className="w-full h-60 object-cover"
                />
                {anime.rating && anime.rating.score !== 0 && (
                  <div className={`absolute top-3 right-3 ${getRatingColor(anime.rating.score)} text-white rounded-full px-2 py-0.5 text-xs font-medium shadow-md`}>
                    {anime.rating.score.toFixed(1)}
                  </div>
                )}
              </div>
              <div className="p-4">
                <h3 className="text-sm font-semibold line-clamp-2">{anime.name_cn || anime.name}</h3>
                {anime.air_date && (
                  <div className="text-xs text-gray-500 mt-2">{anime.air_date}</div>
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
