import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getRatingColorClass(score: number): string {
  if (score < 5) return "bg-destructive"; // 红色 - 低分
  if (score < 7) return "bg-chart-3"; // 黄色 - 中等
  if (score < 9) return "bg-chart-2"; // 绿色 - 高分
  return "bg-primary"; // 蓝色 - 顶级评分
}

// 将星期几转换为 1-7 的格式（周日=7）
export function getWeekdayId(date: Date = new Date()): number {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}
