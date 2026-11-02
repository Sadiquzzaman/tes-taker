"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/component/Toast/ToastContext";
import {
  Button,
  Card,
  ConfirmDialog,
  DatePicker,
  Drawer,
  EmptyState,
  ErrorState,
  Input,
  Link,
  PageHeader,
  Select,
  Skeleton,
  StatusPill,
  Table,
  type TableColumn,
} from "@/design/ui";
import useAcademicsRequest from "@/hooks/academics/useAcademicsRequest";
import { useApiError } from "@/hooks/api/useApiError";
import useFormat from "@/i18n/useFormat";
import axiosReq from "@/lib/axios";
import { SCHOOL_WEEK, todayInSchool } from "@/utils/schoolDate";

const ERROR_CODES = ["HOLIDAY_INVALID_DATE", "HOLIDAY_RANGE_INVALID", "HOLIDAY_RANGE_TOO_LONG", "HOLIDAY_PAST_LOCKED"] as const;
type ErrorCode = (typeof ERROR_CODES)[number];
const isErrorCode = (code: unknown): code is ErrorCode => ERROR_CODES.includes(code as ErrorCode);

interface Draft {
  id: string | null;
  from: string;
  to: string;
  name: string;
}

const EMPTY_DRAFT: Draft = { id: null, from: "", to: "", name: "" };

type When = "past" | "now" | "upcoming";
const whenOf = (holiday: Holiday, today: string): When =>
  holiday.date_to < today ? "past" : holiday.date_from <= today ? "now" : "upcoming";

/**
 * Holidays and closures (CAL-04): single days or ranges with an optional note, by year. Attendance
 * and absence SMS skip these days and the weekly off days. Only days from today on can be added,
 * changed or removed; removing keeps the record.
 */
const HolidaysPage = () => {
  const t = useTranslations("holidays");
  const tSettings = useTranslations("attendanceSettings");
  const format = useFormat();
  const { baseUrl, run, canManageSessions: canEdit } = useAcademicsRequest();
  const { handleError } = useApiError();
  const { triggerToast } = useToast();
  const today = todayInSchool();
  const thisYear = Number(today.slice(0, 4));
  const [year, setYear] = useState(thisYear);
  const [holidays, setHolidays] = useState<Holiday[] | null>(null);
  const [offDays, setOffDays] = useState<number[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [problem, setProblem] = useState<ErrorCode | null>(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<Holiday | null>(null);

  const load = useCallback(async () => {
    setFailed(false);
    setHolidays(null);
    const payload = await run(
      async () => (await axiosReq.get<ApiResponse<Holiday[]>>(`${baseUrl}/holidays`, { params: { from: `${year}-01-01`, to: `${year}-12-31` } })).data?.payload ?? null,
    );
    if (payload) setHolidays(payload);
    else setFailed(true);
  }, [baseUrl, run, year]);

  useEffect(() => {
    void load();
  }, [load]);

  // The weekly off days, shown beside the list (read-only here; changed in the attendance settings).
  useEffect(() => {
    axiosReq
      .get<ApiResponse<AttendanceSettings>>(`${baseUrl}/attendance/settings`)
      .then((response) => setOffDays(response.data?.payload?.weekly_off_days ?? null))
      .catch(() => setOffDays(null));
  }, [baseUrl]);

  const totalDays = useMemo(() => (holidays ?? []).reduce((sum, h) => sum + h.days, 0), [holidays]);

  const openAdd = () => {
    setProblem(null);
    setDraft(EMPTY_DRAFT);
  };

  const openEdit = (holiday: Holiday) => {
    setProblem(null);
    setDraft({ id: holiday.id, from: holiday.date_from, to: holiday.date_to === holiday.date_from ? "" : holiday.date_to, name: holiday.name ?? "" });
  };

  const save = async () => {
    if (!draft) return;
    if (!draft.from) {
      setProblem("HOLIDAY_INVALID_DATE");
      return;
    }
    if (draft.from < today) {
      setProblem("HOLIDAY_PAST_LOCKED");
      return;
    }
    if (draft.to && draft.to < draft.from) {
      setProblem("HOLIDAY_RANGE_INVALID");
      return;
    }
    setSaving(true);
    const body = { date_from: draft.from, date_to: draft.to || draft.from, name: draft.name.trim() || null };
    try {
      if (draft.id) await axiosReq.patch(`${baseUrl}/holidays/${draft.id}`, body);
      else await axiosReq.post(`${baseUrl}/holidays`, body);
      triggerToast({ title: draft.id ? t("updated") : t("added"), type: "success" });
      setDraft(null);
      const savedYear = Number(draft.from.slice(0, 4));
      if (savedYear !== year) setYear(savedYear);
      else void load();
    } catch (error) {
      const code = (error as AxiosError<ApiError>).response?.data?.code;
      if (isErrorCode(code)) setProblem(code);
      else handleError(error as AxiosError<ApiError>);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!removing) return;
    setSaving(true);
    const done = await run(async () => {
      await axiosReq.delete(`${baseUrl}/holidays/${removing.id}`);
      return true;
    }, t("removed"));
    setSaving(false);
    setRemoving(null);
    if (done) void load();
  };

  const dates = (holiday: Holiday) =>
    holiday.date_from === holiday.date_to
      ? format.date(holiday.date_from, { weekday: "short", day: "numeric", month: "short", year: "numeric" })
      : t("range", { from: format.date(holiday.date_from, { day: "numeric", month: "short" }), to: format.date(holiday.date_to) });

  const whenTone: Record<When, "neutral" | "success" | "info"> = { past: "neutral", now: "success", upcoming: "info" };

  const columns: TableColumn<Holiday>[] = [
    { key: "dates", header: t("dates"), cell: (h) => <span className="font-medium text-ink">{dates(h)}</span>, sortValue: (h) => h.date_from },
    { key: "days", header: t("days"), cell: (h) => format.number(h.days), sortValue: (h) => h.days, align: "right" },
    { key: "name", header: t("note"), cell: (h) => h.name ?? <span className="text-ink-muted">—</span> },
    {
      key: "status",
      header: t("status"),
      cell: (h) => {
        const when = whenOf(h, today);
        return <StatusPill tone={whenTone[when]}>{t(`when.${when}`)}</StatusPill>;
      },
    },
    ...(canEdit
      ? [
          {
            key: "actions",
            header: t("actions"),
            align: "right" as const,
            cell: (h: Holiday) =>
              h.date_from >= today ? (
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(h)} aria-label={t("editNamed", { dates: dates(h) })}>
                    {t("edit")}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setRemoving(h)} aria-label={t("removeNamed", { dates: dates(h) })}>
                    {t("remove")}
                  </Button>
                </div>
              ) : (
                <span className="text-caption text-ink-muted">{t("locked")}</span>
              ),
          },
        ]
      : []),
  ];

  const offDayNames = offDays?.length
    ? SCHOOL_WEEK.filter((d) => offDays.includes(d))
        .map((d) => tSettings(`weekday.${d}`))
        .join(", ")
    : null;

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader
        title={t("title")}
        description={t("intro")}
        actions={canEdit ? <Button onClick={openAdd}>{t("add")}</Button> : undefined}
      />

      <div className="grid gap-4 sm:grid-cols-[minmax(0,12rem)_1fr] sm:items-end">
        <Select
          label={t("year")}
          value={String(year)}
          placeholder={false}
          onChange={(event) => setYear(Number(event.target.value))}
          options={[thisYear - 1, thisYear, thisYear + 1].map((y) => ({ value: String(y), label: format.number(y, { useGrouping: false }) }))}
        />
        {offDays ? (
          <p className="text-body-sm text-ink-muted" data-testid="off-days">
            {offDayNames ? t("offDays", { days: offDayNames }) : t("noOffDays")}{" "}
            {canEdit ? <Link href="/attendance-settings">{t("changeOffDays")}</Link> : null}
          </p>
        ) : null}
      </div>

      <Card
        title={t("listTitle", { year: format.number(year, { useGrouping: false }) })}
        description={holidays && holidays.length ? t("summary", { count: holidays.length, days: totalDays }) : undefined}
      >
        {failed ? (
          <ErrorState title={t("loadFailed")} onRetry={() => void load()} />
        ) : !holidays ? (
          <div aria-busy="true">
            <Skeleton lines={4} />
          </div>
        ) : holidays.length === 0 ? (
          <EmptyState
            title={t("empty", { year: format.number(year, { useGrouping: false }) })}
            description={t("emptyHint")}
            action={canEdit ? <Button onClick={openAdd}>{t("add")}</Button> : undefined}
          />
        ) : (
          <Table caption={t("title")} columns={columns} rows={holidays} getRowId={(h) => h.id} />
        )}
      </Card>

      <Drawer
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.id ? t("editTitle") : t("addTitle")}
        description={t("formHint")}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setDraft(null)} disabled={saving}>
              {t("cancel")}
            </Button>
            <Button type="submit" form="holiday-form" loading={saving}>
              {draft?.id ? t("saveChanges") : t("add")}
            </Button>
          </div>
        }
      >
        {draft ? (
          <form
            id="holiday-form"
            noValidate
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <DatePicker
              label={t("from")}
              value={draft.from}
              min={today}
              required
              onChange={(value) => {
                setDraft({ ...draft, from: value });
                setProblem(null);
              }}
            />
            <DatePicker
              label={t("to")}
              hint={t("toHint")}
              value={draft.to}
              min={draft.from || today}
              onChange={(value) => {
                setDraft({ ...draft, to: value });
                setProblem(null);
              }}
            />
            <Input
              label={t("noteLabel")}
              hint={t("noteHint")}
              value={draft.name}
              maxLength={120}
              autoComplete="off"
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
            {problem ? (
              <p role="alert" className="text-body-sm text-danger">
                {t(`errors.${problem}`)}
              </p>
            ) : null}
          </form>
        ) : null}
      </Drawer>

      <ConfirmDialog
        open={removing !== null}
        title={t("removeTitle")}
        description={removing ? t("removeDescription", { dates: dates(removing) }) : undefined}
        confirmLabel={t("remove")}
        loading={saving}
        onConfirm={() => void remove()}
        onCancel={() => setRemoving(null)}
      />
    </div>
  );
};

export default HolidaysPage;
