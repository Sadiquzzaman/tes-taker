"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState, type ReactNode } from "react";
import { INTL_LOCALE } from "@/i18n/config";
import Checkbox from "./Checkbox";
import { cn, focusRing } from "./cn";
import EmptyState from "./EmptyState";
import { ArrowDownIcon, ArrowUpIcon, SortIcon } from "./icons";
import Skeleton from "./Skeleton";

type SortValue = string | number | Date | null | undefined;
export type SortDirection = "asc" | "desc";

export interface TableColumn<Row> {
  key: string;
  /** Column title; also the label of the value in the phone card view. */
  header: string;
  cell: (row: Row) => ReactNode;
  /** Makes the column sortable by this value. */
  sortValue?: (row: Row) => SortValue;
  align?: "left" | "right" | "center";
  /** Leave the column out of the phone card view. */
  hideOnMobile?: boolean;
  className?: string;
}

export interface TableProps<Row> {
  columns: TableColumn<Row>[];
  rows: Row[];
  getRowId: (row: Row) => string;
  /** Read by screen readers as the table's name. */
  caption: string;
  loading?: boolean;
  /** Shown when there are no rows (and not loading); defaults to a plain EmptyState. */
  empty?: ReactNode;
  defaultSort?: { key: string; direction: SortDirection };
  /** Adds a checkbox per row and a "select all" checkbox. */
  selectable?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  onRowClick?: (row: Row) => void;
  className?: string;
}

/** Compares two values in the given direction; empty values always go last, whichever the direction. */
const compare = (a: SortValue, b: SortValue, direction: SortDirection, collator: Intl.Collator) => {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  const factor = direction === "asc" ? 1 : -1;
  if (a instanceof Date && b instanceof Date) return factor * (a.getTime() - b.getTime());
  if (typeof a === "number" && typeof b === "number") return factor * (a - b);
  return factor * collator.compare(String(a), String(b));
};

const ALIGN = { left: "text-left", right: "text-right", center: "text-center" };

/**
 * A data table: click a header to sort, optional row selection, loading and empty states. Below the
 * md breakpoint each row becomes a card (first column as title, the rest as label: value). Filter the
 * rows before passing them (see FilterBar).
 */
function Table<Row>({
  columns,
  rows,
  getRowId,
  caption,
  loading = false,
  empty,
  defaultSort,
  selectable = false,
  selectedIds = [],
  onSelectionChange,
  onRowClick,
  className,
}: TableProps<Row>) {
  const t = useTranslations("ui.table");
  const locale = useLocale();
  const [sort, setSort] = useState(defaultSort ?? null);

  const sortedRows = useMemo(() => {
    const column = sort ? columns.find((candidate) => candidate.key === sort.key) : undefined;
    if (!sort || !column?.sortValue) {
      return rows;
    }
    const collator = new Intl.Collator(INTL_LOCALE[locale], { numeric: true, sensitivity: "base" });
    return [...rows].sort((a, b) => compare(column.sortValue!(a), column.sortValue!(b), sort.direction, collator));
  }, [columns, locale, rows, sort]);

  const selected = new Set(selectedIds);
  const allIds = rows.map(getRowId);
  const selectedCount = allIds.filter((id) => selected.has(id)).length;
  const allSelected = allIds.length > 0 && selectedCount === allIds.length;

  const toggleSort = (key: string) =>
    setSort((current) =>
      current?.key === key ? { key, direction: current.direction === "asc" ? "desc" : "asc" } : { key, direction: "asc" },
    );
  const toggleRow = (id: string) =>
    onSelectionChange?.(selected.has(id) ? selectedIds.filter((value) => value !== id) : [...selectedIds, id]);
  const toggleAll = () => onSelectionChange?.(allSelected ? [] : allIds);

  const showEmpty = !loading && rows.length === 0;
  const [titleColumn, ...detailColumns] = columns;

  return (
    <div className={cn("w-full", className)} aria-busy={loading || undefined}>
      {/* Tablet and desktop: a real table. */}
      <div className="hidden overflow-x-auto rounded-card border border-border bg-surface md:block">
        <table className="w-full border-collapse text-body-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-canvas">
            <tr>
              {selectable ? (
                <th scope="col" className="w-10 px-4 py-3">
                  <Checkbox
                    aria-label={t("selectAll")}
                    checked={allSelected}
                    indeterminate={selectedCount > 0 && !allSelected}
                    onChange={toggleAll}
                    disabled={loading || rows.length === 0}
                  />
                </th>
              ) : null}
              {columns.map((column) => {
                const isSorted = sort?.key === column.key;
                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={isSorted ? (sort.direction === "asc" ? "ascending" : "descending") : undefined}
                    className={cn("px-4 py-3 font-medium text-ink-muted", ALIGN[column.align ?? "left"], column.className)}
                  >
                    {column.sortValue ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(column.key)}
                        aria-label={t("sortBy", { column: column.header })}
                        className={cn("inline-flex items-center gap-1 rounded-sm hover:text-ink", focusRing)}
                      >
                        {column.header}
                        {isSorted ? (
                          sort.direction === "asc" ? (
                            <ArrowUpIcon className="size-3.5" />
                          ) : (
                            <ArrowDownIcon className="size-3.5" />
                          )
                        ) : (
                          <SortIcon className="size-3.5 opacity-50" />
                        )}
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }, (_, index) => (
                  <tr key={`loading-${index}`} className="border-t border-border">
                    {selectable ? <td className="px-4 py-3" /> : null}
                    {columns.map((column) => (
                      <td key={column.key} className="px-4 py-3">
                        <Skeleton />
                      </td>
                    ))}
                  </tr>
                ))
              : sortedRows.map((row) => {
                  const id = getRowId(row);
                  const isSelected = selected.has(id);
                  return (
                    <tr
                      key={id}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                      aria-selected={selectable ? isSelected : undefined}
                      className={cn(
                        "border-t border-border transition-colors duration-(--motion-fast)",
                        isSelected ? "bg-primary-soft" : onRowClick ? "cursor-pointer hover:bg-canvas" : undefined,
                      )}
                    >
                      {selectable ? (
                        <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                          <Checkbox aria-label={t("selectRow")} checked={isSelected} onChange={() => toggleRow(id)} />
                        </td>
                      ) : null}
                      {columns.map((column) => (
                        <td
                          key={column.key}
                          className={cn("px-4 py-3 text-ink", ALIGN[column.align ?? "left"], column.className)}
                        >
                          {column.cell(row)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
          </tbody>
        </table>
        {showEmpty ? <div className="border-t border-border">{empty ?? <EmptyState title={t("empty")} />}</div> : null}
      </div>

      {/* Phones: one card per row. */}
      <div className="flex flex-col gap-3 md:hidden">
        {loading
          ? Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="rounded-card border border-border bg-surface p-4">
                <Skeleton lines={3} />
              </div>
            ))
          : sortedRows.map((row) => {
              const id = getRowId(row);
              const isSelected = selected.has(id);
              return (
                <div
                  key={id}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    "flex gap-3 rounded-card border bg-surface p-4",
                    isSelected ? "border-primary bg-primary-soft" : "border-border",
                    onRowClick && "cursor-pointer",
                  )}
                >
                  {selectable ? (
                    <span onClick={(event) => event.stopPropagation()} className="pt-0.5">
                      <Checkbox aria-label={t("selectRow")} checked={isSelected} onChange={() => toggleRow(id)} />
                    </span>
                  ) : null}
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    {titleColumn ? <div className="font-medium text-ink">{titleColumn.cell(row)}</div> : null}
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-body-sm">
                      {detailColumns
                        .filter((column) => !column.hideOnMobile)
                        .map((column) => (
                          <div key={column.key} className="contents">
                            <dt className="text-ink-muted">{column.header}</dt>
                            <dd className="min-w-0 text-ink">{column.cell(row)}</dd>
                          </div>
                        ))}
                    </dl>
                  </div>
                </div>
              );
            })}
        {showEmpty ? (
          <div className="rounded-card border border-border bg-surface">{empty ?? <EmptyState title={t("empty")} />}</div>
        ) : null}
      </div>
    </div>
  );
}

export default Table;
