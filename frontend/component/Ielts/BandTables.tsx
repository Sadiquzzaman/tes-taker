"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useState } from "react";
import useApiData from "@/component/Homework/useApiData";
import { useToast } from "@/component/Toast/ToastContext";
import { Badge, Button, Card, EmptyState, ErrorState, IconButton, Input, PageHeader, Select, Skeleton, CloseIcon } from "@/design/ui";
import { useApiError } from "@/hooks/api/useApiError";
import useWorkspace from "@/hooks/organization/useWorkspace";
import useFormat from "@/i18n/useFormat";
import axiosReq from "@/lib/axios";
import { BANDS } from "./bands";

type Row = { min_raw: string; band: string };

const tableKey = (table: IeltsBandTable) => (table.module === "LISTENING" ? "LISTENING" : `READING_${table.test_type}`) as "LISTENING" | "READING_ACADEMIC" | "READING_GENERAL";

/**
 * Band tables (P10-03, IEL-04, IEL-05): raw Listening / Reading scores (out of 40) to bands. Staff
 * read them; owners and admins change the centre's copy or put it back to the default.
 */
const BandTables = () => {
  const t = useTranslations("ieltsBands");
  const { memberRole } = useWorkspace();
  const canEdit = memberRole === "OWNER" || memberRole === "ADMIN";
  const { data: tables, failed, reload } = useApiData<IeltsBandTable[]>("/ielts/band-tables");

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader title={t("pageTitle")} description={t("pageDescription")} />
      {!canEdit ? <p className="text-body-sm text-ink-muted">{t("readOnly")}</p> : null}
      {failed !== null ? (
        <ErrorState title={failed === 403 ? t("notAvailable") : t("loadFailed")} onRetry={reload} />
      ) : !tables ? (
        <Card aria-busy="true">
          <Skeleton lines={6} />
        </Card>
      ) : tables.length === 0 ? (
        <EmptyState title={t("loadFailed")} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {tables.map((table) => (
            <BandTableCard key={tableKey(table)} table={table} canEdit={canEdit} onChanged={reload} />
          ))}
        </div>
      )}
    </div>
  );
};

const BandTableCard = ({ table, canEdit, onChanged }: { table: IeltsBandTable; canEdit: boolean; onChanged: () => void }) => {
  const t = useTranslations("ieltsBands");
  const format = useFormat();
  const { triggerToast } = useToast();
  const { handleError } = useApiError();
  const [rows, setRows] = useState<Row[]>(table.rows.map((r) => ({ min_raw: String(r.min_raw), band: String(r.band) })));
  const [busy, setBusy] = useState(false);
  const scope = { module: table.module, ...(table.test_type ? { test_type: table.test_type } : {}) };
  const bandOptions = BANDS.map((b) => ({ value: String(b), label: format.number(b, { minimumFractionDigits: 1 }) }));

  const send = async (request: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await request();
      triggerToast({ title: done, type: "success" });
      onChanged();
    } catch (err) {
      handleError(err as AxiosError<ApiError>);
    } finally {
      setBusy(false);
    }
  };

  const save = () =>
    send(
      () => axiosReq.put(`${process.env.NEXT_PUBLIC_BASE_URL}/ielts/band-tables`, { ...scope, rows: rows.map((r) => ({ min_raw: Number(r.min_raw), band: Number(r.band) })) }),
      t("saved"),
    );
  const reset = () => send(() => axiosReq.post(`${process.env.NEXT_PUBLIC_BASE_URL}/ielts/band-tables/reset`, scope), t("resetDone"));
  const change = (index: number, field: keyof Row, value: string) => setRows(rows.map((r, i) => (i === index ? { ...r, [field]: value } : r)));

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-title-sm font-semibold text-ink">{t(`tables.${tableKey(table)}`)}</h2>
        <Badge tone={table.customised ? "info" : "neutral"}>{table.customised ? t("customised") : t("default")}</Badge>
      </div>
      <table className="w-full text-body-sm">
        <thead>
          <tr className="text-left text-ink-muted">
            <th className="pb-2 font-medium">{t("minRaw")}</th>
            <th className="pb-2 font-medium">{t("band")}</th>
            {canEdit ? (
              <th>
                <span className="sr-only">{t("remove")}</span>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {canEdit ? (
                <>
                  <td className="py-1 pr-2">
                    <Input
                      aria-label={`${t("minRaw")} ${i + 1}`}
                      type="number"
                      min={0}
                      max={40}
                      value={row.min_raw}
                      onChange={(e) => change(i, "min_raw", e.target.value)}
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <Select aria-label={`${t("band")} ${i + 1}`} value={row.band} onChange={(e) => change(i, "band", e.target.value)} options={bandOptions} />
                  </td>
                  <td className="py-1">
                    <IconButton label={t("removeRow", { index: i + 1 })} icon={<CloseIcon />} variant="ghost" onClick={() => setRows(rows.filter((_, j) => j !== i))} />
                  </td>
                </>
              ) : (
                <>
                  <td className="py-1">{format.number(Number(row.min_raw))}</td>
                  <td className="py-1">{format.number(Number(row.band), { minimumFractionDigits: 1 })}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {canEdit ? (
        <>
          <p className="mt-3 text-xs text-ink-muted">{t("rule")}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => setRows([...rows, { min_raw: "0", band: "0" }])}>
              {t("addRow")}
            </Button>
            <Button size="sm" loading={busy} onClick={() => void save()}>
              {t("save")}
            </Button>
            {table.customised ? (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => void reset()}>
                {t("reset")}
              </Button>
            ) : null}
          </div>
        </>
      ) : null}
    </Card>
  );
};

export default BandTables;
