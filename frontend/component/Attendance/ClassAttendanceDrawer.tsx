"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Badge, Button, Drawer, ErrorState, Input, Select, Skeleton, Textarea } from "@/design/ui";
import useFormat from "@/i18n/useFormat";
import axiosReq from "@/lib/axios";
import { StatusMark } from "./AttendanceCalendar";

const CORRECTABLE: AttendanceStatus[] = ["PRESENT", "LATE", "ABSENT"];

/** Problems the drawer explains itself (messages `classAttendance.errors`). */
const KNOWN_ERRORS = [
  "ATTENDANCE_CORRECTION_NOT_STARTED",
  "ATTENDANCE_CORRECTION_CLOSED_DAY",
  "ATTENDANCE_CORRECTION_PERSON_NOT_FOUND",
  "ATTENDANCE_CORRECTION_TEACHER_RECORD",
  "ATTENDANCE_CORRECTION_NO_CHANGE",
] as const;
type CorrectionError = (typeof KNOWN_ERRORS)[number];
const isKnownError = (code: unknown): code is CorrectionError => KNOWN_ERRORS.includes(code as CorrectionError);

interface Props {
  baseUrl?: string;
  /** The class to show; null closes the drawer. */
  target: { slot_id: string; date: string; title: string } | null;
  timeZone?: string;
  onClose: () => void;
  /** After a correction, with the class as it is now. */
  onCorrected: (detail: ClassSessionDetail, name: string) => void;
  onError: (error: AxiosError<ApiError>) => void;
}

/**
 * One class's list for staff (ATT-07, ATT-12): every student with their status (colour and
 * letter), check-in time, minutes late, distance and any flag, and the corrections made so far; a
 * correction takes the new status and a reason. Teachers' own rows are corrected by owners, admins
 * and assistants only (the API says which rows can be corrected).
 */
const ClassAttendanceDrawer = ({ baseUrl, target, timeZone, onClose, onCorrected, onError }: Props) => {
  const t = useTranslations("classAttendance");
  const tMine = useTranslations("myAttendance");
  const format = useFormat();
  const [detail, setDetail] = useState<ClassSessionDetail | null>(null);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [status, setStatus] = useState<AttendanceStatus>("PRESENT");
  const [lateMinutes, setLateMinutes] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState("");

  useEffect(() => {
    setDetail(null);
    setFailed(false);
    setEditing(null);
    if (!target) return;
    let live = true;
    axiosReq
      .get<ApiResponse<ClassSessionDetail>>(`${baseUrl}/attendance/sessions/${target.slot_id}/${target.date}`)
      .then((response) => live && setDetail(response.data?.payload ?? null))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [baseUrl, target]);

  const clock = (iso: string) => format.date(iso, { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone });

  const startEditing = (row: ClassRosterRow) => {
    setEditing(row.person.id);
    setStatus(row.status === "PRESENT" ? "ABSENT" : "PRESENT");
    setLateMinutes(row.record?.late_minutes != null ? String(row.record.late_minutes) : "");
    setReason("");
    setProblem("");
  };

  const save = async (row: ClassRosterRow) => {
    if (!target) return;
    if (reason.trim().length < 3) {
      setProblem(t("reasonRequired"));
      return;
    }
    setSaving(true);
    setProblem("");
    try {
      const body: Record<string, unknown> = { status, reason: reason.trim() };
      if (status === "LATE" && lateMinutes !== "") body.late_minutes = Number(lateMinutes);
      const response = await axiosReq.put<ApiResponse<ClassSessionDetail>>(
        `${baseUrl}/attendance/sessions/${target.slot_id}/${target.date}/records/${row.person.id}`,
        body,
      );
      if (response.data?.payload) {
        setDetail(response.data.payload);
        setEditing(null);
        onCorrected(response.data.payload, row.person.full_name);
      }
    } catch (error) {
      const data = (error as AxiosError<ApiError>).response?.data;
      if (data && isKnownError(data.code)) setProblem(t(`errors.${data.code}`));
      else onError(error as AxiosError<ApiError>);
    } finally {
      setSaving(false);
    }
  };

  const personRow = (row: ClassRosterRow) => {
    const roll = row.person.roll_no && /^\d+$/.test(row.person.roll_no) ? format.number(Number(row.person.roll_no)) : row.person.roll_no;
    const name = roll ? `${roll}. ${row.person.full_name}` : row.person.full_name;
    const statusText =
      row.status === "LATE" && row.record?.late_minutes != null ? tMine("lateBy", { minutes: row.record.late_minutes }) : tMine(`status.${row.status}`);
    return (
      <li key={row.person.id} className="flex flex-col gap-2 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <StatusMark status={row.status} label={tMine(`status.${row.status}`)} />
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="font-medium text-ink">{name}</span>
              <span className="text-body-sm text-ink-muted">
                {statusText}
                {row.record?.checked_in_at ? ` · ${t("checkedInAt", { time: clock(row.record.checked_in_at) })}` : ""}
                {row.record?.distance_m != null ? ` · ${t("distance", { distance: row.record.distance_m, accuracy: row.record.accuracy_m ?? 0 })}` : ""}
              </span>
              {row.record?.flag ? <Badge tone="warning">{t(`flag.${row.record.flag}`)}</Badge> : null}
            </div>
          </div>
          {row.can_correct && editing !== row.person.id ? (
            <Button size="sm" variant="secondary" onClick={() => startEditing(row)} aria-label={t("correctFor", { name: row.person.full_name })}>
              {t("correct")}
            </Button>
          ) : null}
        </div>

        {row.corrections.length > 0 ? (
          <ul aria-label={t("trailFor", { name: row.person.full_name })} className="ml-9 flex flex-col gap-1 border-l border-border pl-3 text-caption text-ink-muted">
            {row.corrections.map((c) => (
              <li key={c.id}>
                {t("trailLine", {
                  from: c.old_status ? tMine(`status.${c.old_status}`) : t("noRecord"),
                  to: tMine(`status.${c.new_status}`),
                  who: c.corrected_by?.full_name ?? t("someone"),
                  when: format.dateTime(c.created_at),
                })}
                {` — ${c.reason}`}
              </li>
            ))}
          </ul>
        ) : null}

        {editing === row.person.id ? (
          <div className="ml-9 flex flex-col gap-3 rounded-input border border-border bg-canvas p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Select
                label={t("newStatus")}
                placeholder={false}
                value={status}
                onChange={(event) => setStatus(event.target.value as AttendanceStatus)}
                options={CORRECTABLE.map((value) => ({ value, label: tMine(`status.${value}`) }))}
              />
              {status === "LATE" ? (
                <Input label={t("lateMinutes")} type="number" min={0} max={600} value={lateMinutes} onChange={(event) => setLateMinutes(event.target.value)} />
              ) : null}
            </div>
            <Textarea label={t("reason")} hint={t("reasonHint")} value={reason} onChange={(event) => setReason(event.target.value)} rows={2} maxLength={500} />
            {problem ? (
              <p role="alert" className="text-body-sm text-danger">
                {problem}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setEditing(null)} disabled={saving}>
                {t("cancel")}
              </Button>
              <Button size="sm" onClick={() => void save(row)} disabled={saving}>
                {saving ? t("saving") : t("saveCorrection")}
              </Button>
            </div>
          </div>
        ) : null}
      </li>
    );
  };

  return (
    <Drawer
      open={target !== null}
      onClose={onClose}
      title={target?.title ?? ""}
      description={
        detail
          ? `${t("timeRange", { start: clock(detail.starts_at), end: clock(detail.ends_at) })} · ${tMine(`classType.${detail.class_type}`)}${
              detail.closed ? ` · ${tMine(`closed.${detail.closed.reason}`, { name: detail.closed.holiday_name ?? "" })}` : ""
            }`
          : undefined
      }
    >
      {failed ? (
        <ErrorState title={t("loadFailed")} />
      ) : !detail ? (
        <div aria-busy="true">
          <Skeleton lines={6} />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {!detail.can_correct && !detail.closed ? <p className="text-body-sm text-ink-muted">{t("notStartedHint")}</p> : null}
          <section aria-label={t("students")}>
            <h3 className="text-body font-semibold text-ink">{t("studentsCount", { count: detail.students.length })}</h3>
            {detail.students.length === 0 ? (
              <p className="py-3 text-body-sm text-ink-muted">{t("noStudents")}</p>
            ) : (
              <ul className="divide-y divide-border">{detail.students.map(personRow)}</ul>
            )}
          </section>
          {detail.teachers.length > 0 ? (
            <section aria-label={t("teachers")}>
              <h3 className="text-body font-semibold text-ink">{t("teachers")}</h3>
              <ul className="divide-y divide-border">{detail.teachers.map(personRow)}</ul>
            </section>
          ) : null}
        </div>
      )}
    </Drawer>
  );
};

export default ClassAttendanceDrawer;
