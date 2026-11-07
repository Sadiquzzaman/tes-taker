"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button, Select, Textarea, TimePicker } from "@/design/ui";
import useWorkspace from "@/hooks/organization/useWorkspace";
import useFormat from "@/i18n/useFormat";
import axiosReq from "@/lib/axios";

/** Refusals the form explains itself (messages `classAttendance.errors`). */
const CHANGE_ERRORS = [
  "ATTENDANCE_CHANGE_STARTED",
  "ATTENDANCE_CHANGE_TIME_INVALID",
  "ATTENDANCE_CHANGE_OVERLAP",
  "ATTENDANCE_CHANGE_TEACHER_INVALID",
  "ATTENDANCE_CHANGE_NONE",
  "ATTENDANCE_CANCEL_CLOSED_DAY",
  "ATTENDANCE_CANCEL_PAST",
  "ATTENDANCE_CANCEL_TOO_FAR",
  "ATTENDANCE_CANCEL_ALREADY",
] as const;
type ChangeError = (typeof CHANGE_ERRORS)[number];
const isChangeError = (code: unknown): code is ChangeError => (CHANGE_ERRORS as readonly unknown[]).includes(code);

interface Props {
  baseUrl?: string;
  detail: ClassSessionDetail;
  /** "HH:MM" of an instant in the organisation's time zone. */
  clock: (iso: string) => string;
  onChanged: (detail: ClassSessionDetail) => void;
  onError: (error: AxiosError<ApiError>) => void;
}

/**
 * One-day changes of a class (P5-04, CAL-01): shows a change already made (the routine's times,
 * the substitute, who and when, the note) with "Undo"; before check-in opens it offers other times
 * that day and/or a substitute teacher, with a note for the students. The routine is not changed.
 */
const ClassChangeSection = ({ baseUrl, detail, clock, onChanged, onError }: Props) => {
  const t = useTranslations("classAttendance.change");
  const tErrors = useTranslations("classAttendance.errors");
  const format = useFormat();
  const { organizationId, isIndividual } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [substitute, setSubstitute] = useState("");
  const [note, setNote] = useState("");
  const [teachers, setTeachers] = useState<{ id: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");

  // Teachers who can take the class: the organisation's teaching members (loaded when the form opens).
  useEffect(() => {
    if (!open || isIndividual || !organizationId) return;
    let live = true;
    axiosReq
      .get<ApiResponse<OrganizationMemberItem[]>>(`${baseUrl}/organizations/${organizationId}/assignable-teachers`)
      .then((response) => {
        if (live) setTeachers((response.data?.payload ?? []).map((member) => ({ id: member.user.id, name: member.user.full_name ?? member.user.email ?? "" })));
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [baseUrl, open, organizationId, isIndividual]);

  const routineTeacher = detail.change ? (detail.change.substitute ? null : detail.teacher) : detail.teacher;

  const startForm = () => {
    setStart(clock(detail.starts_at));
    setEnd(clock(detail.ends_at));
    setSubstitute(detail.change?.substitute?.id ?? "");
    setNote(detail.change?.note ?? "");
    setProblem("");
    setOpen(true);
  };

  const send = async (body: Record<string, unknown>) => {
    setBusy(true);
    setProblem("");
    try {
      const response = await axiosReq.post<ApiResponse<ClassSessionDetail>>(`${baseUrl}/attendance/sessions/${detail.slot_id}/${detail.date}/change`, body);
      if (response.data?.payload) {
        setOpen(false);
        onChanged(response.data.payload);
      }
    } catch (error) {
      const data = (error as AxiosError<ApiError & { details?: { start_time?: string; end_time?: string } }>).response?.data;
      if (data && isChangeError(data.code)) setProblem(tErrors(data.code, { start: data.details?.start_time ?? "", end: data.details?.end_time ?? "" }));
      else onError(error as AxiosError<ApiError>);
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    if (!start || !end || end <= start) {
      setProblem(tErrors("ATTENDANCE_CHANGE_TIME_INVALID"));
      return;
    }
    void send({ start_time: start, end_time: end, substitute_teacher_id: substitute || null, ...(note.trim() ? { note: note.trim() } : {}) });
  };

  const undo = () =>
    detail.change && void send({ start_time: detail.change.routine_start_time, end_time: detail.change.routine_end_time, substitute_teacher_id: null });

  if (detail.cancelled || (!detail.change && !detail.can_change)) return null;

  return (
    <section aria-label={t("title")} className="flex flex-col gap-3 rounded-input border border-border bg-canvas p-3">
      {detail.change ? (
        <div className="flex flex-col gap-1">
          <span className="font-medium text-ink">{t("changedTitle")}</span>
          <span className="text-body-sm text-ink">
            {t("routineTimes", { start: detail.change.routine_start_time, end: detail.change.routine_end_time })}
            {" → "}
            {t("dayTimes", { start: clock(detail.starts_at), end: clock(detail.ends_at) })}
          </span>
          {detail.change.substitute ? <span className="text-body-sm text-ink">{t("substituteIs", { name: detail.change.substitute.full_name })}</span> : null}
          {detail.change.at ? (
            <span className="text-body-sm text-ink-muted">{t("changedBy", { who: detail.change.by?.full_name ?? t("someone"), when: format.dateTime(detail.change.at) })}</span>
          ) : null}
          {detail.change.note ? <span className="text-body-sm text-ink">{t("noteIs", { note: detail.change.note })}</span> : null}
        </div>
      ) : null}

      {open ? (
        <div className="flex flex-col gap-3">
          <p className="text-body-sm text-ink-muted">{t("intro")}</p>
          <div className="grid grid-cols-2 gap-3">
            <TimePicker label={t("start")} value={start} onChange={setStart} />
            <TimePicker label={t("end")} value={end} onChange={setEnd} />
          </div>
          <Select
            label={t("substitute")}
            value={substitute}
            placeholder={routineTeacher ? t("routineTeacher", { name: routineTeacher.full_name }) : t("noSubstitute")}
            options={teachers.filter((teacher) => teacher.id !== routineTeacher?.id).map((teacher) => ({ value: teacher.id, label: teacher.name }))}
            onChange={(event) => setSubstitute(event.target.value)}
          />
          <Textarea label={t("note")} hint={t("noteHint")} value={note} rows={2} maxLength={300} onChange={(event) => setNote(event.target.value)} />
        </div>
      ) : null}

      {problem ? (
        <p role="alert" className="text-body-sm text-danger">
          {problem}
        </p>
      ) : null}

      {detail.can_change ? (
        <div className="flex flex-wrap justify-end gap-2">
          {open ? (
            <>
              <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
                {t("close")}
              </Button>
              <Button size="sm" onClick={save} loading={busy}>
                {t("save")}
              </Button>
            </>
          ) : (
            <>
              {detail.change ? (
                <Button size="sm" variant="ghost" onClick={undo} loading={busy}>
                  {t("undo")}
                </Button>
              ) : null}
              <Button size="sm" variant="secondary" onClick={startForm}>
                {detail.change ? t("editChange") : t("open")}
              </Button>
            </>
          )}
        </div>
      ) : null}
    </section>
  );
};

export default ClassChangeSection;
