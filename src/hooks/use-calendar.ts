import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { CalendarDay } from "../types/bangumi";
import { getCalendar } from "../lib/api"; // 从封装的 API 模块导入

export function useCalendar() {
  const [data, setData] = useState<CalendarDay[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const calendarData = await getCalendar();
      setData(calendarData);
    } catch (error) {
      console.error("加载日历数据失败:", error);
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
