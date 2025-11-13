import { useState, useEffect } from "react";
import { ArrowLeft, Calendar, Star, Eye } from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { Anime } from "../../types/bangumi";

const AnimeDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [anime, setAnime] = useState<Anime | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 这里需要替换为真实的API调用
    // 目前使用mock数据
    const mockAnime: Anime = {
      id: Number(id),
      url: "",
      type: 1,
      name: "测试动画",
      name_cn: "测试动画中文名称",
      summary: "这是一个测试动画的简介，用来展示详情页的效果。",
      air_date: "2023-04-01",
      air_weekday: 6,
      rating: {
        total: 1000,
        count: { "10": 500, "9": 300, "8": 200 },
        score: 9.2,
      },
      images: {
        large: "https://picsum.photos/id/1005/600/900",
        common: "https://picsum.photos/id/1005/300/450",
        medium: "https://picsum.photos/id/1005/200/300",
        small: "https://picsum.photos/id/1005/100/150",
        grid: "https://picsum.photos/id/1005/80/120",
      },
      collection: {
        doing: 10000,
      },
    };

    // 模拟API请求延迟
    const timer = window.setTimeout(() => {
      setAnime(mockAnime);
      setLoading(false);
    }, 500);

    return () => window.clearTimeout(timer);
  }, [id]);

  if (loading) {
    return (
      <div className="p-8">
        <div className="mb-6">
          <div className="h-8 w-40 bg-gray-200 rounded animate-pulse"></div>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-1">
            <div className="h-96 bg-gray-200 rounded-xl animate-pulse"></div>
          </div>
          <div className="md:col-span-2 space-y-4">
            <div className="h-10 w-2/3 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-6 w-1/3 bg-gray-200 rounded animate-pulse"></div>
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-4 w-full bg-gray-200 rounded animate-pulse"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!anime) {
    return (
      <div className="p-8">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">未找到该动画</h2>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            返回上一页
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回
        </button>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* 左侧海报 */}
        <div className="md:col-span-1">
          <div className="rounded-xl overflow-hidden shadow-lg">
            <img
              src={anime.images.large}
              alt={anime.name}
              className="w-full aspect-[2/3] object-cover"
            />
          </div>
        </div>

        {/* 右侧详情 */}
        <div className="md:col-span-2 space-y-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              {anime.name_cn || anime.name}
            </h1>
            <p className="text-muted-foreground">{anime.name}</p>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
              <span className="text-xl font-semibold">
                {anime.rating.score.toFixed(1)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span>{anime.air_date}</span>
            </div>
            {anime.collection && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Eye className="w-4 h-4" />
                <span>{anime.collection.doing.toLocaleString()}人在看</span>
              </div>
            )}
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-3">简介</h3>
            <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
              {anime.summary || "暂无简介"}
            </p>
          </div>

          {/* 可以在这里添加更多详情内容，比如剧集列表、STAFF信息等 */}
        </div>
      </div>
    </div>
  );
};

export default AnimeDetailPage;