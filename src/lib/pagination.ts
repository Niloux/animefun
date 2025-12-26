export type PageItem = number | "ellipsis";

export function visiblePages(totalPages: number, current: number): PageItem[] {
  const pages: PageItem[] = [];
  const tp = Math.max(1, totalPages);
  const c = Math.min(Math.max(1, current), tp);
  if (tp <= 7) {
    for (let i = 1; i <= tp; i++) pages.push(i);
    return pages;
  }
  pages.push(1);
  if (c > 3) pages.push("ellipsis");
  const start = Math.max(2, c - 1);
  const end = Math.min(tp - 1, c + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (c < tp - 2) pages.push("ellipsis");
  pages.push(tp);
  return pages;
}
