"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/component/Toast/ToastContext";
import { Badge, Button, Card, DatePicker, EmptyState, ErrorState, PageHeader, Skeleton, StatusPill, Table, type TableColumn } from "@/design/ui";
import { useApiError } from "@/hooks/api/useApiError";
import useFormat from "@/i18n/useFormat";
import axiosReq from "@/lib/axios";
import ClassAttendanceDrawer from "./ClassAttendanceDrawer";

const STATE_TONE = { UPCOMING: "neutral", OPEN: "primary", CLOSED: "neutral" } as const;

/**
 * Class attendance for staff (ATT-07, ATT-11, ATT-12): the classes of a day with how many students
 * are present, late, absent or not in yet, and flagged check-ins; a class opens in a drawer to
 * see everyone and correct a status with a reason. No roll call: students check themselves in.
 */
const ClassAttendancePage = () => {
  const t = useTranslations("classAttendance");
  const format = useFormat();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const { handleError } = useApiError();
  const { triggerToast } = useToast();
  const [date, setDate] = useState("");
  const [data, setData] = useState<ClassSessionsOnDate | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<{ slot_id: string; date: string; title: string } | null>(null);

  const fetchDay = useCallback(
    () => axiosReq.get<ApiResponse<ClassSessionsOnDate>>(`${baseUrl}/attendance/sessions`, { params: date ? { date } : {} }),
    [baseUrl, date],
  );

  const load = useCallback(async () => {
    try {
      setData((await fetchDay()).data?.payload ?? null);
      setFailed(false);
    } catch (error) {
      setFailed(true);
      handleError(error as AxiosError<ApiError>);
    }
  }, [fetchDay, handleError]);

  useEffect(() => {
    let live = true;
    fetchDay()
      .then((response) => {
        if (!live) return;
        setData(response.data?.payload ?? null);
        setFailed(false);
      })
      .catch((error: AxiosError<ApiError>) => {
        if (!live) return;
        setFailed(true);
        handleError(error);
      });
    return () => {
      live = false;
    };
  }, [fetchDay, handleError]);

  const clock = (iso: string) => format.date(iso, { hour: "numeric", minute: "2-digit", timeZone: data?.time_zone });
  const title = (row: ClassSessionSummary) => `${row.section.class_name} ${row.section.name}`;

  const columns: TableColumn<ClassSessionSummary>[] = [
    {
      key: "class",
      header: t("class"),
      sortValue: title,
      cell: (row) => (
        <div className="flex flex-col gap-1">
          <span className="font-medium text-ink">{title(row)}</span>
          <span className="text-caption text-ink-muted">{`${clock(row.starts_at)}–${clock(row.ends_at)}${row.teacher ? ` · ${row.teacher.full_name}` : ""}`}</span>
        </div>
      ),
    },
    {
      key: "state",
      header: t("checkIn"),
      cell: (row) =>
        row.closed ? (
          <Badge>{t("closedDay")}</Badge>
        ) : row.mode === "PAPER_REGISTER" ? (
          <Badge>{t("paperRegister")}</Badge>
        ) : (
          <StatusPill tone={STATE_TONE[row.state]}>{t(`state.${row.state}`)}</StatusPill>
        ),
    },
    {
      key: "counts",
      header: t("students"),
      cell: (row) => (
        <div className="flex flex-wrap gap-1.5" aria-label={t("countsLabel", { ...row.counts })}>
          <Badge tone="success">{t("countPresent", { count: row.counts.present })}</Badge>
          <Badge tone="warning">{t("countLate", { count: row.counts.late })}</Badge>
          <Badge tone="danger">{t("countAbsent", { count: row.counts.absent })}</Badge>
          {row.counts.leave > 0 ? <Badge tone="info">{t("countLeave", { count: row.counts.leave })}</Badge> : null}
          {row.counts.waiting > 0 ? <Badge>{t("countWaiting", { count: row.counts.waiting })}</Badge> : null}
          {row.counts.flagged > 0 ? <Badge tone="warning">{t("countFlagged", { count: row.counts.flagged })}</Badge> : null}
        </div>
      ),
    },
    {
      key: "actions",
      header: t("actions"),
      align: "right",
      cell: (row) => (
        <Button size="sm" variant="secondary" onClick={() => setOpen({ slot_id: row.slot_id, date: row.date, title: title(row) })} aria-label={t("openFor", { section: title(row) })}>
          {row.can_correct ? t("viewAndCorrect") : t("view")}
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader title={t("title")} description={t("intro")} />

      <div className="grid gap-4 sm:grid-cols-3">
        <DatePicker label={t("date")} value={date || data?.date || ""} max={data?.today} onChange={(value) => setDate(value)} />
      </div>

      <Card
        title={data ? t("classesOn", { date: format.date(`${data.date}T00:00:00Z`, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }) }) : undefined}
        description={data?.closed ? t(`closed.${data.closed.reason}`, { name: data.closed.holiday_name ?? "" }) : undefined}
      >
        {failed && !data ? (
          <ErrorState title={t("loadFailed")} onRetry={() => void load()} />
        ) : !data ? (
          <div aria-busy="true">
            <Skeleton lines={5} />
          </div>
        ) : data.sessions.length === 0 ? (
          <EmptyState title={t("empty")} description={t("emptyHint")} />
        ) : (
          <Table caption={t("title")} columns={columns} rows={data.sessions} getRowId={(row) => row.slot_id} />
        )}
      </Card>

      <ClassAttendanceDrawer
        baseUrl={baseUrl}
        target={open}
        timeZone={data?.time_zone}
        onClose={() => setOpen(null)}
        onCorrected={(detail, name) => {
          triggerToast({ title: t("corrected", { name }), type: "success" });
          setData((current) => (current ? { ...current, sessions: current.sessions.map((s) => (s.slot_id === detail.slot_id ? { ...s, counts: detail.counts } : s)) } : current));
        }}
        onError={handleError}
      />
    </div>
  );
};

export default ClassAttendancePage;
