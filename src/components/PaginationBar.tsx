import React from "react";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "./ui/pagination";
import { visiblePages } from "@/lib/pagination";

interface PaginationBarProps {
  currentPage: number; // 1-based
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export const PaginationBar = React.memo(
  ({
    currentPage,
    totalPages,
    onPageChange,
    className,
  }: PaginationBarProps) => {
    if (totalPages <= 1) return null;

    const pages = visiblePages(totalPages, currentPage);

    return (
      <div className={className}>
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                className={
                  currentPage <= 1
                    ? "pointer-events-none opacity-50"
                    : undefined
                }
                onClick={(e) => {
                  e.preventDefault();
                  if (currentPage > 1) onPageChange(currentPage - 1);
                }}
              />
            </PaginationItem>

            {pages.map((p, idx) =>
              p === "ellipsis" ? (
                <PaginationItem key={`ellipsis-${idx}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={p}>
                  <PaginationLink
                    href="#"
                    isActive={p === currentPage}
                    onClick={(e) => {
                      e.preventDefault();
                      if (p !== currentPage) onPageChange(Number(p));
                    }}
                  >
                    {p}
                  </PaginationLink>
                </PaginationItem>
              )
            )}

            <PaginationItem>
              <PaginationNext
                href="#"
                className={
                  currentPage >= totalPages
                    ? "pointer-events-none opacity-50"
                    : undefined
                }
                onClick={(e) => {
                  e.preventDefault();
                  if (currentPage < totalPages) onPageChange(currentPage + 1);
                }}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    );
  }
);

PaginationBar.displayName = "PaginationBar";
