"use client";

import NextLink from "next/link";
import { useTranslations } from "next-intl";
import { Fragment } from "react";
import { cn, focusRing } from "./cn";
import { ChevronRightIcon } from "./icons";

export interface BreadcrumbItem {
  label: string;
  /** Leave out for the current page (the last item). */
  href?: string;
}

/** Where the page sits: Classes › Physics 9A › Attendance. The last item is the current page. */
const Breadcrumb = ({ items, className }: { items: BreadcrumbItem[]; className?: string }) => {
  const t = useTranslations("ui");

  return (
    <nav aria-label={t("breadcrumb")} className={className}>
      <ol className="flex flex-wrap items-center gap-1 text-body-sm">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <Fragment key={`${item.label}-${index}`}>
              <li className="min-w-0">
                {item.href && !isLast ? (
                  <NextLink
                    href={item.href}
                    className={cn("truncate rounded-sm text-ink-muted hover:text-ink hover:underline", focusRing)}
                  >
                    {item.label}
                  </NextLink>
                ) : (
                  <span aria-current={isLast ? "page" : undefined} className="truncate font-medium text-ink">
                    {item.label}
                  </span>
                )}
              </li>
              {!isLast ? (
                <li aria-hidden="true" className="text-ink-muted">
                  <ChevronRightIcon className="size-3.5" />
                </li>
              ) : null}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
};

export default Breadcrumb;
