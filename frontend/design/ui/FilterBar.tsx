"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import Button from "./Button";
import { cn } from "./cn";
import { SearchIcon } from "./icons";
import Input from "./Input";

export interface FilterBarProps {
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  /** Extra filters (Selects, a DatePicker…), shown after the search box. */
  children?: ReactNode;
  /** Shows "Clear filters" while any filter is set. */
  onClear?: () => void;
  hasActiveFilters?: boolean;
  className?: string;
}

/** Search and filters above a Table or list. Stacks on phones. */
const FilterBar = ({
  search,
  onSearchChange,
  searchPlaceholder,
  children,
  onClear,
  hasActiveFilters = false,
  className,
}: FilterBarProps) => {
  const t = useTranslations("ui");

  return (
    <div role="search" className={cn("flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end", className)}>
      {onSearchChange ? (
        <Input
          type="search"
          label={t("search")}
          hideLabel
          placeholder={searchPlaceholder ?? t("search")}
          value={search ?? ""}
          onChange={(event) => onSearchChange(event.target.value)}
          leadingIcon={<SearchIcon />}
          fieldClassName="sm:w-72"
        />
      ) : null}
      {children}
      {onClear && hasActiveFilters ? (
        <Button variant="ghost" onClick={onClear}>
          {t("clearFilters")}
        </Button>
      ) : null}
    </div>
  );
};

export default FilterBar;
