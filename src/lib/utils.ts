import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Anime } from "../types/gen/bangumi";

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
export function scoreCandidate(a: Anime): number {
  const s1 = a.rating?.score || 0;
  const s2 = a.rating?.rank ? (10000 - a.rating.rank) / 10000 : 0;
  const d = a.date || "";
  const y = d.split("-")[0];
  const yr = y ? parseInt(y, 10) : 0;
  const cy = new Date().getFullYear();
  const recent = yr > 0 && cy - yr <= 3 ? 1 : 0;
  return s1 + s2 + recent;
}

export function matchTier(q: string, a: Anime): number {
  const n1 = (a.name_cn || "").toLowerCase();
  const n2 = (a.name || "").toLowerCase();
  if (!q) return 0;
  if (n1.startsWith(q) || n2.startsWith(q)) return 2;
  if (n1.includes(q) || n2.includes(q)) return 1;
  return 0;
}

export function sortAnimeList(arr: Anime[], sort: string): Anime[] {
  const byScore = (a: Anime) => a.rating?.score ?? 0;
  const byRank = (a: Anime) => {
    const r = a.rating?.rank ?? 0;
    return r > 0 ? r : Number.POSITIVE_INFINITY;
  };
  const byHeat = (a: Anime) => {
    const pop = (a.collection?.doing ?? 0) + (a.collection?.collect ?? 0);
    const votes = a.rating?.total ?? 0;
    return pop > 0 ? pop : votes;
  };
  const listCopy = [...arr];
  switch (sort) {
    case "score":
      return listCopy.sort((a, b) => byScore(b) - byScore(a));
    case "rank":
      return listCopy.sort((a, b) => byRank(a) - byRank(b));
    case "heat":
      return listCopy.sort((a, b) => byHeat(b) - byHeat(a));
    case "match":
      return listCopy.sort((a, b) => byScore(b) - byScore(a));
    default:
      return listCopy;
  }
}

export function formatBytes(bytes: number | bigint, decimals = 2) {
  const b = Number(bytes);
  if (b === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return parseFloat((b / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function formatDuration(seconds: number | bigint) {
  const s = Number(seconds);
  if (s <= 0) return '-';
  if (s >= 8640000) return '∞'; 

  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);

  if (h > 24) return '> 1d';
  
  const parts = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (sec > 0 && h === 0) parts.push(`${sec}s`); // Only show seconds if less than an hour to save space

  return parts.join(' ');
}
