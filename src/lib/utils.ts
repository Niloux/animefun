import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Anime } from "../types/bangumi";

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

// 搜索界面的自动完成建议评分函数
export function scoreCandidate(q: string, a: Anime): number {
  const n1 = (a.name_cn || "").toLowerCase();
  const n2 = (a.name || "").toLowerCase();
  const prefix = n1.startsWith(q) || n2.startsWith(q) ? 3 : 0;
  const contain = prefix === 0 && (n1.includes(q) || n2.includes(q)) ? 1 : 0;
  const s1 = (a.rating?.score || 0) * 0.5;
  const s2 = a.rating?.rank ? (10000 - a.rating.rank) / 10000 : 0;
  const d = a.air_date || a.date || "";
  const y = d.split("-")[0];
  const yr = y ? parseInt(y, 10) : 0;
  const cy = new Date().getFullYear();
  const recent = yr > 0 && cy - yr <= 3 ? 0.5 : 0;
  return prefix + contain + s1 + s2 + recent;
}
