"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/component/Toast/ToastContext";
import { Badge, Button, Card, Checkbox, ConfirmDialog, ErrorState, Input, PageHeader, RadioGroup, Skeleton, TimePicker } from "@/design/ui";
import useAcademicsRequest from "@/hooks/academics/useAcademicsRequest";
import { useApiError } from "@/hooks/api/useApiError";
import axiosReq from "@/lib/axios";
import { SCHOOL_WEEK } from "@/utils/schoolDate";

const ERROR_CODES = [
  "ATTENDANCE_METHOD_NOT_AVAILABLE",
  "ATTENDANCE_PRESENCE_NOT_FOR_SOLO",
  "ATTENDANCE_SELFIE_NEEDS_APP",
  "ATTENDANCE_NO_WORKING_DAY",
] as const;
type ErrorCode = (typeof ERROR_CODES)[number];
const isErrorCode = (code: unknown): code is ErrorCode => ERROR_CODES.includes(code as ErrorCode);

/** Methods that cannot be chosen yet (owner decision, 2 Nov 2026: website check-in first). */
const COMING_SOON: AttendanceMethod[] = ["ZKTECO", "APP"];
const SMS_KEYS = ["late", "absent", "leave"] as const;

/**
 * The workspace's attendance settings (ATT-01): the daily presence method (one at a time), how
 * teachers take class attendance, entry times, weekly off days, guardian SMS and the repeated-absence
 * alert. Owners and admins (and a solo teacher) change them; other staff see them read-only.
 */
const AttendanceSettingsPage = () => {
  const t = useTranslations("attendanceSettings");
  const { baseUrl, run, isIndividual, canManageSessions: canEdit } = useAcademicsRequest();
  const { handleError } = useApiError();
  const { triggerToast } = useToast();
  const [saved, setSaved] = useState<AttendanceSettings | null>(null);
  const [draft, setDraft] = useState<AttendanceSettings | null>(null);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<ErrorCode | null>(null);
  const [confirmSwitch, setConfirmSwitch] = useState(false);

  const show = useCallback((settings: AttendanceSettings) => {
    setSaved(settings);
    setDraft(settings);
    setProblem(null);
  }, []);

  const load = useCallback(async () => {
    setFailed(false);
    const payload = await run(async () => (await axiosReq.get<ApiResponse<AttendanceSettings>>(`${baseUrl}/attendance/settings`)).data?.payload ?? null);
    if (payload) show(payload);
    else setFailed(true);
  }, [baseUrl, run, show]);

  useEffect(() => {
    void load();
  }, [load]);

  const change = (next: Partial<AttendanceSettings>) => {
    setDraft((current) => (current ? { ...current, ...next } : current));
    setProblem(null);
  };

  const toggleOffDay = (day: number, off: boolean) => {
    if (!draft) return;
    change({ weekly_off_days: off ? [...draft.weekly_off_days, day].sort((a, b) => a - b) : draft.weekly_off_days.filter((d) => d !== day) });
  };

  const save = async (confirmed = false) => {
    if (!draft) return;
    if (draft.weekly_off_days.length >= 7) {
      setProblem("ATTENDANCE_NO_WORKING_DAY");
      return;
    }
    setSaving(true);
    try {
      const body = {
        ...(isIndividual ? {} : { attendance_method: draft.attendance_method }),
        class_attendance_mode: draft.class_attendance_mode,
        weekly_off_days: draft.weekly_off_days,
        student_entry_time: draft.student_entry_time,
        teacher_entry_time: draft.teacher_entry_time,
        guardian_sms: draft.guardian_sms,
        repeat_absence_days: Number(draft.repeat_absence_days),
        ...(confirmed ? { confirm_method_change: true } : {}),
      };
      const response = await axiosReq.patch<ApiResponse<AttendanceSettings>>(`${baseUrl}/attendance/settings`, body);
      if (response.data?.payload) show(response.data.payload);
      setConfirmSwitch(false);
      triggerToast({ title: t("saved"), type: "success" });
    } catch (error) {
      const code = (error as AxiosError<ApiError>).response?.data?.code;
      if (code === "ATTENDANCE_METHOD_CHANGE_CONFIRM") setConfirmSwitch(true);
      else if (isErrorCode(code)) setProblem(code);
      else handleError(error as AxiosError<ApiError>);
    } finally {
      setSaving(false);
    }
  };

  const header = <PageHeader title={t("title")} description={t("intro")} />;

  if (failed) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        {header}
        <Card>
          <ErrorState title={t("loadFailed")} onRetry={() => void load()} />
        </Card>
      </div>
    );
  }

  if (!draft || !saved) {
    return (
      <div className="flex flex-col gap-6 pb-8" aria-busy="true">
        {header}
        <Card>
          <Skeleton lines={8} />
        </Card>
      </div>
    );
  }

  const repeatDaysInvalid = !Number.isInteger(Number(draft.repeat_absence_days)) || draft.repeat_absence_days < 2 || draft.repeat_absence_days > 30;
  const methodOptions = (["OFF", "WEB", "ZKTECO", "APP"] as AttendanceMethod[]).map((method) => ({
    value: method,
    disabled: !canEdit || COMING_SOON.includes(method),
    label: (
      <span className="inline-flex flex-wrap items-center gap-2">
        {t(`method.${method}`)}
        {COMING_SOON.includes(method) ? <Badge tone="neutral">{t("comingSoon")}</Badge> : null}
      </span>
    ),
    hint: t(`methodHint.${method}`),
  }));

  return (
    <form
      noValidate
      className="flex flex-col gap-6 pb-8"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      {header}
      {!canEdit ? (
        <p className="rounded-card bg-info-soft px-4 py-3 text-body-sm text-ink" role="note">
          {t("readOnly")}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={t("presenceTitle")} description={t("presenceIntro")}>
          {isIndividual ? (
            <p className="text-body-sm text-ink-muted">{t("soloPresence")}</p>
          ) : (
            <RadioGroup
              legend={t("presenceLegend")}
              name="attendance_method"
              options={methodOptions}
              value={draft.attendance_method}
              onChange={(value) => change({ attendance_method: value as AttendanceMethod })}
            />
          )}
        </Card>

        <Card title={t("classTitle")} description={t("classIntro")}>
          <RadioGroup
            legend={t("classLegend")}
            name="class_attendance_mode"
            options={(["PER_SESSION", "DAILY", "OFF"] as ClassAttendanceMode[]).map((mode) => ({
              value: mode,
              disabled: !canEdit,
              label: t(`classMode.${mode}`),
              hint: t(`classModeHint.${mode}`),
            }))}
            value={draft.class_attendance_mode}
            onChange={(value) => change({ class_attendance_mode: value as ClassAttendanceMode })}
          />
        </Card>

        <Card title={t("hoursTitle")} description={t("hoursIntro")}>
          <div className="flex flex-col gap-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <TimePicker
                label={t("studentEntry")}
                value={draft.student_entry_time}
                onChange={(value) => change({ student_entry_time: value })}
                disabled={!canEdit}
                required
              />
              <TimePicker
                label={t("teacherEntry")}
                value={draft.teacher_entry_time}
                onChange={(value) => change({ teacher_entry_time: value })}
                disabled={!canEdit}
                required
              />
            </div>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-body-sm font-medium text-ink">{t("offDays")}</legend>
              <p className="text-caption text-ink-muted">{t("offDaysHint")}</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
                {SCHOOL_WEEK.map((day) => (
                  <Checkbox
                    key={day}
                    label={t(`weekday.${day}`)}
                    checked={draft.weekly_off_days.includes(day)}
                    onChange={(event) => toggleOffDay(day, event.target.checked)}
                    disabled={!canEdit}
                  />
                ))}
              </div>
            </fieldset>
          </div>
        </Card>

        <Card title={t("alertsTitle")} description={t("alertsIntro")}>
          <div className="flex flex-col gap-5">
            <fieldset className="flex flex-col gap-3">
              <legend className="mb-1 text-body-sm font-medium text-ink">{t("guardianSms")}</legend>
              {SMS_KEYS.map((key) => (
                <Checkbox
                  key={key}
                  label={t(`sms.${key}`)}
                  hint={t(`smsHint.${key}`)}
                  checked={draft.guardian_sms[key]}
                  onChange={(event) => change({ guardian_sms: { ...draft.guardian_sms, [key]: event.target.checked } })}
                  disabled={!canEdit}
                />
              ))}
            </fieldset>
            <Input
              label={t("repeatDays")}
              hint={t("repeatDaysHint")}
              type="number"
              inputMode="numeric"
              min={2}
              max={30}
              step={1}
              trailing={t("daysUnit")}
              value={String(draft.repeat_absence_days)}
              error={repeatDaysInvalid ? t("repeatDaysError") : undefined}
              onChange={(event) => change({ repeat_absence_days: event.target.value === "" ? Number.NaN : Number(event.target.value) })}
              disabled={!canEdit}
            />
          </div>
        </Card>
      </div>

      {canEdit ? (
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
          {problem ? (
            <p role="alert" className="text-body-sm text-danger sm:mr-auto">
              {t(`errors.${problem}`)}
            </p>
          ) : null}
          <Button type="button" variant="ghost" onClick={() => show(saved)} disabled={saving}>
            {t("undo")}
          </Button>
          <Button type="submit" loading={saving} disabled={repeatDaysInvalid || !draft.student_entry_time || !draft.teacher_entry_time}>
            {t("save")}
          </Button>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmSwitch}
        title={t("switchTitle")}
        description={t("switchDescription", { from: t(`method.${saved.attendance_method}`), to: t(`method.${draft.attendance_method}`) })}
        confirmLabel={t("switchConfirm")}
        loading={saving}
        onConfirm={() => void save(true)}
        onCancel={() => setConfirmSwitch(false)}
      />
    </form>
  );
};

export default AttendanceSettingsPage;
