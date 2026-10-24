"use client";

import { useTranslations } from "next-intl";
import useFormat from "@/i18n/useFormat";
import { cn, focusRing } from "./cn";
import IconButton from "./IconButton";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons";

export interface PaginationProps {
  /** 1-based. */
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  className?: string;
}

/** Page numbers to show: always the first and last, the current page with one on each side, "…" between. */
export const pageWindow = (page: number, pageCount: number): Array<number | "gap"> => {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }
  const pages = new Set([1, pageCount, page - 1, page, page + 1].filter((value) => value >= 1 && value <= pageCount));
  const sorted = [...pages].sort((a, b) => a - b);
  return sorted.flatMap((value, index) => (index > 0 && value - sorted[index - 1] > 1 ? (["gap", value] as const) : [value]));
};

/** Previous / page numbers / next. On phones only previous, "page of pages" and next. */
const Pagination = ({ page, pageCount, onPageChange, className }: PaginationProps) => {
  const t = useTranslations("ui.pagination");
  const format = useFormat();

  if (pageCount <= 1) {
    return null;
  }

  return (
    <nav aria-label={t("label")} className={cn("flex items-center justify-between gap-2 sm:justify-center", className)}>
      <IconButton
        variant="secondary"
        label={t("previous")}
        icon={<ChevronLeftIcon />}
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      />
      <span className="text-body-sm text-ink-muted sm:hidden">
        {format.number(page)} / {format.number(pageCount)}
      </span>
      <ul className="hidden items-center gap-1 sm:flex">
        {pageWindow(page, pageCount).map((item, index) =>
          item === "gap" ? (
            <li key={`gap-${index}`} aria-hidden="true" className="px-1 text-ink-muted">
              …
            </li>
          ) : (
            <li key={item}>
              <button
                type="button"
                onClick={() => onPageChange(item)}
                aria-label={t("page", { page: item })}
                aria-current={item === page ? "page" : undefined}
                className={cn(
                  "inline-flex h-10 min-w-10 items-center justify-center rounded-input px-2 text-body-sm font-medium",
                  "transition-colors duration-(--motion-fast)",
                  item === page ? "bg-primary text-ink-inverse" : "text-ink hover:bg-canvas",
                  focusRing,
                )}
              >
                {format.number(item)}
              </button>
            </li>
          ),
        )}
      </ul>
      <IconButton
        variant="secondary"
        label={t("next")}
        icon={<ChevronRightIcon />}
        disabled={page >= pageCount}
        onClick={() => onPageChange(page + 1)}
      />
    </nav>
  );
};

export default Pagination;
