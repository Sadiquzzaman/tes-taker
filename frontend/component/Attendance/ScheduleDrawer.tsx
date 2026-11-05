"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { Button, Checkbox, Drawer, Select, TimePicker } from "@/design/ui";
import axiosReq from "@/lib/axios";
import { rowProblems, rowsFromSlots, ScheduleRow, slotsFromRows } from "@/utils/attendance/schedule";
import { IsoDay, SCHOOL_WEEK } from "@/utils/schoolDate";

const ERROR_CODES = [
  "SCHEDULE_TIME_INVALID",
  "SCHEDULE_OVERLAP",
  "SCHEDULE_TEACHER_CLASH",
  "SCHEDULE_TOO_MANY",
  "ATTENDANCE_SETUP_TEACHER_INVALID",
  "ATTENDANCE_SETUP_SOURCE_INVALID",
] as const;
type ErrorCode = (typeof ERROR_CODES)[number];
const isErrorCode = (code: unknown): code is ErrorCode => ERROR_CODES.includes(code as ErrorCode);

interface ScheduleError {
  code: ErrorCode;
  row: number | null;
  clashWith?: string;
}

interface ScheduleDrawerProps {
  baseUrl: string | undefined;
  section: SectionSetup | null;
  /** Other sections of the session to copy from. */
  sections: SectionSetup[];
  /** Teaching members to choose for a slot; null hides the teacher choice (solo workspace or a teacher's own view). */
  teachers: { id: string; name: string }[] | null;
  sectionName: (section: SectionSetup) => string;
  onClose: () => void;
  onSaved: (section: SectionSetup, copied: boolean) => void;
  onError: (error: AxiosError<ApiError>) => void;
}

const emptyRow = (): ScheduleRow => ({ days: [], start: "", end: "", teacher_id: null });

/**
 * A section's weekly schedule (ATT-16), one line per time: tick the days, set the start and end
 * (and a teacher if wanted). Saving replaces the whole schedule; "copy from" takes another
 * section's schedule as it is.
 */
const ScheduleDrawer = ({ baseUrl, section, sections, teachers, sectionName, onClose, onSaved, onError }: ScheduleDrawerProps) => {
  const t = useTranslations("classSetup");
  const tDays = useTranslations("attendanceSettings.weekday");
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [error, setError] = useState<ScheduleError | null>(null);
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copyFrom, setCopyFrom] = useState("");

  useEffect(() => {
    if (!section) return;
    const initial = rowsFromSlots(section.slots);
    setRows(initial.length > 0 ? initial : [emptyRow()]);
    setError(null);
    setChecked(false);
    setCopyFrom("");
  }, [section]);

  const problems = useMemo(() => rowProblems(rows), [rows]);
  // An untouched empty line is ignored; anything half filled must be finished.
  const isBlank = (row: ScheduleRow) => row.days.length === 0 && !row.start && !row.end;
  const toSave = rows.filter((row) => !isBlank(row));

  const change = (index: number, next: Partial<ScheduleRow>) => {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...next } : row)));
    setError(null);
  };

  const toggleDay = (index: number, day: number, on: boolean) =>
    change(index, { days: on ? [...rows[index].days, day] : rows[index].days.filter((d) => d !== day) });

  const failWith = (caught: unknown, rowOf: number[]) => {
    const data = (caught as AxiosError<ApiError & { details?: { slot?: number; section?: { name: string; class_name: string | null } } }>).response?.data;
    if (isErrorCode(data?.code)) {
      const slot = data?.details?.slot;
      const clash = data?.details?.section;
      setError({
        code: data.code,
        row: typeof slot === "number" ? (rowOf[slot] ?? null) : null,
        clashWith: clash ? [clash.class_name, clash.name].filter(Boolean).join(" ") : undefined,
      });
    } else {
      onError(caught as AxiosError<ApiError>);
    }
  };

  const save = async () => {
    if (!section) return;
    setChecked(true);
    if (rows.some((row, index) => !isBlank(row) && problems[index])) return;
    const { slots, rowOf: savedRowOf } = slotsFromRows(toSave);
    // Map saved slots back to the visible rows (blank lines are skipped).
    const visible = rows.map((row, index) => (isBlank(row) ? -1 : index)).filter((index) => index !== -1);
    const rowOf = savedRowOf.map((i) => visible[i]);
    setSaving(true);
    try {
      const response = await axiosReq.put<ApiResponse<SectionSetup>>(`${baseUrl}/attendance/setup/sections/${section.id}/slots`, { slots });
      if (response.data?.payload) onSaved(response.data.payload, false);
    } catch (caught) {
      failWith(caught, rowOf);
    } finally {
      setSaving(false);
    }
  };

  const copy = async () => {
    if (!section || !copyFrom) return;
    setSaving(true);
    try {
      const response = await axiosReq.post<ApiResponse<SectionSetup>>(`${baseUrl}/attendance/setup/sections/${section.id}/copy`, {
        from_section_id: copyFrom,
      });
      if (response.data?.payload) onSaved(response.data.payload, true);
    } catch (caught) {
      failWith(caught, []);
    } finally {
      setSaving(false);
    }
  };

  const sources = sections.filter((other) => section && other.id !== section.id && other.slots.length > 0);

  return (
    <Drawer
      open={section !== null}
      onClose={onClose}
      title={section ? t("scheduleTitle", { section: sectionName(section) }) : ""}
      description={t("scheduleHint")}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {t("cancel")}
          </Button>
          <Button type="submit" form="schedule-form" loading={saving}>
            {t("saveSchedule")}
          </Button>
        </div>
      }
    >
      {section ? (
        <form
          id="schedule-form"
          noValidate
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          {sources.length > 0 ? (
            <div className="flex flex-col gap-2 rounded-card bg-canvas p-3 sm:flex-row sm:items-end">
              <Select
                label={t("copyFrom")}
                value={copyFrom}
                placeholder={t("copyPlaceholder")}
                fieldClassName="flex-1"
                onChange={(event) => setCopyFrom(event.target.value)}
                options={sources.map((other) => ({ value: other.id, label: sectionName(other) }))}
              />
              <Button type="button" variant="secondary" onClick={() => void copy()} disabled={!copyFrom || saving}>
                {t("copy")}
              </Button>
            </div>
          ) : null}

          {rows.map((row, index) => {
            const problem = checked && !isBlank(row) ? problems[index] : null;
            const apiProblem = error && error.row === index ? error : null;
            return (
              <fieldset key={index} className="flex flex-col gap-3 rounded-card border border-border p-3" aria-label={t("slotLabel", { number: index + 1 })}>
                <legend className="sr-only">{t("slotLabel", { number: index + 1 })}</legend>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2 min-[360px]:grid-cols-3">
                  {SCHOOL_WEEK.map((day) => (
                    <Checkbox
                      key={day}
                      label={tDays(String(day) as `${IsoDay}`)}
                      checked={row.days.includes(day)}
                      onChange={(event) => toggleDay(index, day, event.target.checked)}
                    />
                  ))}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <TimePicker label={t("start")} value={row.start} onChange={(value) => change(index, { start: value })} />
                  <TimePicker label={t("end")} value={row.end} onChange={(value) => change(index, { end: value })} />
                </div>
                {teachers ? (
                  <Select
                    label={t("teacher")}
                    hint={t("teacherHint")}
                    value={row.teacher_id ?? ""}
                    placeholder={t("noTeacher")}
                    onChange={(event) => change(index, { teacher_id: event.target.value || null })}
                    options={teachers.map((teacher) => ({ value: teacher.id, label: teacher.name }))}
                  />
                ) : null}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p role={problem || apiProblem ? "alert" : undefined} className="text-body-sm text-danger">
                    {problem
                      ? t(`rowErrors.${problem}`)
                      : apiProblem
                        ? t(`errors.${apiProblem.code}`, { section: apiProblem.clashWith ?? "" })
                        : null}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setRows((current) => (current.length > 1 ? current.filter((_, i) => i !== index) : [emptyRow()]))}
                  >
                    {t("removeSlot")}
                  </Button>
                </div>
              </fieldset>
            );
          })}

          <Button type="button" variant="secondary" onClick={() => setRows((current) => [...current, emptyRow()])}>
            {t("addSlot")}
          </Button>
          {error && error.row === null ? (
            <p role="alert" className="text-body-sm text-danger">
              {t(`errors.${error.code}`, { section: error.clashWith ?? "" })}
            </p>
          ) : null}
        </form>
      ) : null}
    </Drawer>
  );
};

export default ScheduleDrawer;
