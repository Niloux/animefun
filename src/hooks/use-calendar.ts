import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { CalendarDay } from "../types/bangumi";

export function useCalendar() {
  const [data, setData] = useState<CalendarDay[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/calendar.json");

      // 检查响应状态
      if (!response.ok) {
        throw new Error(`加载失败: ${response.statusText}`);
      }

      const calendarData = await response.json();
      setData(calendarData);
    } catch (error) {
      console.error("加载数据失败:", error);
      toast.error(error instanceof Error ? error.message : "加载数据失败", {
        duration: 5000,
        action: {
          label: "重试",
          onClick: () => loadData(),
        },
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // 组件挂载时加载数据
  useEffect(() => {
    loadData();
  }, [loadData]);

  return { data, loading, reload: loadData };
}
