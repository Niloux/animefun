import { useMemo } from "react";
import { Button } from "../../components/ui/button";
import { AnimeGrid } from "../../components/AnimeGrid";
import { useSubscriptions } from "../../hooks/use-subscriptions";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../../constants/routes";

const SubscribePage = () => {
  const navigate = useNavigate();
  const { list, clear } = useSubscriptions();
  const items = useMemo(() => list, [list]);

  return (
    <div className="px-4 py-0 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">我的订阅</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate(ROUTES.SEARCH)}>
            去搜索
          </Button>
          <Button variant="destructive" onClick={() => clear()}>
            清空订阅
          </Button>
        </div>
      </div>
      {items.length === 0 ? (
        <div className="text-muted-foreground">暂无订阅</div>
      ) : (
        <AnimeGrid items={items} />
      )}
    </div>
  );
};

export default SubscribePage;
