"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { Card, DatePicker, EmptyState, FilterBar, Pagination, Select, Skeleton, Table, Tag, type TableColumn } from "@/design/ui";
import { useApiError } from "@/hooks/api/useApiError";
import useFormat from "@/i18n/useFormat";
import axiosReq from "@/lib/axios";
import AuditLogDetails from "./AuditLogDetails";
import useAuditText, { AUDIT_AREAS } from "./useAuditText";

const PAGE_SIZE = 20;

/** A "YYYY-MM-DD" day as the start of that day, or of the next day (for "to", which is exclusive). */
export const dayBoundary = (day: string, nextDay = false): string | undefined => {
  if (!day) return undefined;
  const date = new Date(`${day}T00:00:00`);
  if (nextDay) date.setDate(date.getDate() + 1);
  return date.toISOString();
};

interface AuditLogTableProps {
  /**
   * `platform`: every organisation, with IPs (`GET /audit-logs/admin`, platform admins).
   * `organization`: the current workspace only (`GET /audit-logs`, its owner and admins).
   */
  scope: "platform" | "organization";
}

/** The audit log (design §8.10): who did what, to which record, when. Filter by area and dates; open a row for details. */
const AuditLogTable = ({ scope }: AuditLogTableProps) => {
  const t = useTranslations("audit");
  const format = useFormat();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const { handleError } = useApiError();
  const { actionName, areaName, summary, actorName } = useAuditText();
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [area, setArea] = useState("");
  const [fromDay, setFromDay] = useState("");
  const [toDay, setToDay] = useState("");
  const [organization, setOrganization] = useState<{ id: string; name: string } | null>(null);
  const [selected, setSelected] = useState<AuditLogItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: AuditLogFilters & { page: number; limit: number } = {
        page,
        limit: PAGE_SIZE,
        action: area ? `${area}.` : undefined,
        from: dayBoundary(fromDay),
        to: dayBoundary(toDay, true),
        organization_id: scope === "platform" ? organization?.id : undefined,
      };
      const res = await axiosReq.get<AuditLogListResponse>(`${baseUrl}/audit-logs${scope === "platform" ? "/admin" : ""}`, { params });
      setLogs(res.data?.payload ?? []);
      setPageCount(res.data?.meta?.total_pages ?? 1);
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    } finally {
      setLoading(false);
    }
  }, [area, baseUrl, fromDay, handleError, organization, page, scope, toDay]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Any filter change starts again from the first page. */
  const filter = <T,>(set: (value: T) => void) => (value: T) => {
    set(value);
    setPage(1);
  };

  const hasFilters = Boolean(area || fromDay || toDay || organization);
  const clearFilters = () => {
    setArea("");
    setFromDay("");
    setToDay("");
    setOrganization(null);
    setPage(1);
  };

  const columns: TableColumn<AuditLogItem>[] = [
    { key: "when", header: t("when"), cell: (row) => <span className="whitespace-nowrap">{format.dateTime(row.created_at)}</span> },
    { key: "who", header: t("who"), cell: (row) => actorName(row) },
    ...(scope === "platform"
      ? [{ key: "organization", header: t("organization"), cell: (row: AuditLogItem) => row.organization?.name ?? t("platform"), hideOnMobile: true }]
      : []),
    { key: "action", header: t("action"), cell: (row) => <span className="font-medium">{actionName(row.action)}</span> },
    {
      key: "summary",
      header: t("summary"),
      cell: (row) => (
        <span className="flex flex-col">
          <span className="break-words">{summary(row) || "—"}</span>
          {row.reason ? <span className="text-caption text-ink-muted">{t("reasonValue", { reason: row.reason })}</span> : null}
        </span>
      ),
      hideOnMobile: true,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <FilterBar hasActiveFilters={hasFilters} onClear={clearFilters}>
        <Select
          label={t("area")}
          fieldClassName="sm:w-56"
          placeholder={false}
          value={area}
          onChange={(event) => filter(setArea)(event.target.value)}
          options={[{ value: "", label: t("allAreas") }, ...AUDIT_AREAS.map((value) => ({ value, label: areaName(value) }))]}
        />
        <DatePicker label={t("from")} fieldClassName="sm:w-44" value={fromDay} max={toDay || undefined} onChange={filter(setFromDay)} />
        <DatePicker label={t("to")} fieldClassName="sm:w-44" value={toDay} min={fromDay || undefined} onChange={filter(setToDay)} />
      </FilterBar>
      {organization ? (
        <div>
          <Tag label={t("organizationFilter", { name: organization.name })} onRemove={() => filter(setOrganization)(null)}>
            {t("organizationFilter", { name: organization.name })}
          </Tag>
        </div>
      ) : null}
      <Card flush>
        {loading ? (
          <div className="p-4" aria-busy="true">
            <Skeleton lines={6} />
          </div>
        ) : (
          <Table
            caption={t("title")}
            columns={columns}
            rows={logs}
            getRowId={(row) => row.id}
            onRowClick={setSelected}
            empty={<EmptyState title={hasFilters ? t("emptyFiltered") : t("empty")} />}
          />
        )}
      </Card>
      <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />
      <AuditLogDetails
        log={selected}
        onClose={() => setSelected(null)}
        onFilterOrganization={scope === "platform" ? filter(setOrganization) : undefined}
      />
    </div>
  );
};

export default AuditLogTable;
