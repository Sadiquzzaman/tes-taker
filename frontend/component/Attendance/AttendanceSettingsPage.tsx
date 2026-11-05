"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/component/Toast/ToastContext";
import { Button, Card, Checkbox, ErrorState, Input, Link, PageHeader, Skeleton } from "@/design/ui";
import useAcademicsRequest from "@/hooks/academics/useAcademicsRequest";
import { useApiError } from "@/hooks/api/useApiError";
import useFormat from "@/i18n/useFormat";
import axiosReq from "@/lib/axios";
import { SCHOOL_WEEK } from "@/utils/schoolDate";
import LocationFields, { LocationDraft, locationBody, locationDraftOf, locationProblems, sameLocation } from "./LocationFields";

const SMS_KEYS = ["late", "absent", "leave"] as const;

const wholeIn = (value: number, min: number, max: number) => Number.isInteger(value) && value >= min && value <= max;

/**
 * The workspace's attendance settings (ATT-01 as changed on 5 Nov 2026): where in-person check-in
 * is allowed (the main branch's pin and radius, or a link to the branches), the grace period before
 * Late, weekly off days, guardian SMS and the repeated-absence alert. Class times come from each
 * section's schedule. Owners and admins (and a solo teacher) change them; other staff read them.
 */
const AttendanceSettingsPage = () => {
  const t = useTranslations("attendanceSettings");
  const tBranches = useTranslations("branches");
  const format = useFormat();
  const { baseUrl, run, isIndividual, canManageSessions: canEdit } = useAcademicsRequest();
  const { handleError } = useApiError();
  const { triggerToast } = useToast();
  const [saved, setSaved] = useState<AttendanceSettings | null>(null);
  const [draft, setDraft] = useState<AttendanceSettings | null>(null);
  const [branches, setBranches] = useState<Branch[] | null>(null);
  const [location, setLocation] = useState<LocationDraft | null>(null);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  const main = branches?.find((branch) => branch.is_default) ?? null;
  // One location: a solo teacher, or an organisation that has not added branches.
  const singleLocation = isIndividual || (branches?.length ?? 0) <= 1;

  const load = useCallback(async () => {
    setFailed(false);
    const payload = await run(async () => {
      const [settings, list] = await Promise.all([
        axiosReq.get<ApiResponse<AttendanceSettings>>(`${baseUrl}/attendance/settings`),
        axiosReq.get<ApiResponse<Branch[]>>(`${baseUrl}/attendance/branches`),
      ]);
      return settings.data?.payload && list.data?.payload ? { settings: settings.data.payload, branches: list.data.payload } : null;
    });
    if (!payload) {
      setFailed(true);
      return;
    }
    setSaved(payload.settings);
    setDraft(payload.settings);
    setBranches(payload.branches);
    const mainBranch = payload.branches.find((branch) => branch.is_default);
    setLocation(mainBranch ? locationDraftOf(mainBranch) : null);
  }, [baseUrl, run]);

  useEffect(() => {
    void load();
  }, [load]);

  const change = (next: Partial<AttendanceSettings>) => setDraft((current) => (current ? { ...current, ...next } : current));

  const toggleOffDay = (day: number, off: boolean) => {
    if (!draft) return;
    change({ weekly_off_days: off ? [...draft.weekly_off_days, day].sort((a, b) => a - b) : draft.weekly_off_days.filter((d) => d !== day) });
  };

  const undo = () => {
    setDraft(saved);
    setLocation(main ? locationDraftOf(main) : null);
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const response = await axiosReq.patch<ApiResponse<AttendanceSettings>>(`${baseUrl}/attendance/settings`, {
        late_grace_minutes: Number(draft.late_grace_minutes),
        weekly_off_days: draft.weekly_off_days,
        guardian_sms: draft.guardian_sms,
        repeat_absence_days: Number(draft.repeat_absence_days),
      });
      if (response.data?.payload) {
        setSaved(response.data.payload);
        setDraft(response.data.payload);
      }
      if (singleLocation && main && location && !sameLocation(location, locationDraftOf(main))) {
        const updated = await axiosReq.patch<ApiResponse<Branch>>(`${baseUrl}/attendance/branches/${main.id}`, locationBody(location));
        const branch = updated.data?.payload;
        if (branch) {
          setBranches((current) => (current ?? []).map((b) => (b.id === branch.id ? branch : b)));
          setLocation(locationDraftOf(branch));
        }
      }
      triggerToast({ title: t("saved"), type: "success" });
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
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

  if (!draft || !saved || !branches) {
    return (
      <div className="flex flex-col gap-6 pb-8" aria-busy="true">
        {header}
        <Card>
          <Skeleton lines={8} />
        </Card>
      </div>
    );
  }

  const graceInvalid = !wholeIn(Number(draft.late_grace_minutes), 0, 60);
  const repeatDaysInvalid = !wholeIn(Number(draft.repeat_absence_days), 2, 30);
  const noWorkingDay = draft.weekly_off_days.length >= 7;
  const locationInvalid = singleLocation && location !== null && Object.keys(locationProblems(location)).length > 0;
  const numberValue = (value: string) => (value === "" ? Number.NaN : Number(value));

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
        <Card title={t("locationTitle")} description={t("locationIntro")}>
          {singleLocation && location ? (
            <div className="flex flex-col gap-4">
              <LocationFields value={location} onChange={setLocation} disabled={!canEdit} />
              {!isIndividual && canEdit ? (
                <p className="text-body-sm text-ink-muted">
                  {t("moreBranches")} <Link href="/attendance-branches">{t("addBranches")}</Link>
                </p>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-body-sm text-ink">{t("branchesSummary", { count: branches.length })}</p>
              <ul className="flex flex-col gap-1 text-body-sm">
                {branches.map((branch) => (
                  <li key={branch.id} className="flex flex-wrap justify-between gap-2">
                    <span className="font-medium text-ink">{branch.name ?? tBranches("mainBranch")}</span>
                    <span className="text-ink-muted">
                      {branch.geo_lat === null
                        ? tBranches("noPin")
                        : tBranches("radiusShort", { radius: format.number(branch.checkin_radius_m) })}
                    </span>
                  </li>
                ))}
              </ul>
              {canEdit ? <Link href="/attendance-branches">{t("manageBranches")}</Link> : null}
            </div>
          )}
        </Card>

        <Card title={t("daysTitle")} description={t("daysIntro")}>
          <div className="flex flex-col gap-5">
            <Input
              label={t("grace")}
              hint={t("graceHint")}
              type="number"
              inputMode="numeric"
              min={0}
              max={60}
              step={1}
              trailing={t("minutesUnit")}
              value={Number.isNaN(draft.late_grace_minutes) ? "" : String(draft.late_grace_minutes)}
              error={graceInvalid ? t("graceError") : undefined}
              onChange={(event) => change({ late_grace_minutes: numberValue(event.target.value) })}
              disabled={!canEdit}
            />
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
              {noWorkingDay ? (
                <p role="alert" className="text-body-sm text-danger">
                  {t("noWorkingDay")}
                </p>
              ) : null}
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
              value={Number.isNaN(draft.repeat_absence_days) ? "" : String(draft.repeat_absence_days)}
              error={repeatDaysInvalid ? t("repeatDaysError") : undefined}
              onChange={(event) => change({ repeat_absence_days: numberValue(event.target.value) })}
              disabled={!canEdit}
            />
          </div>
        </Card>
      </div>

      {canEdit ? (
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
          <Button type="button" variant="ghost" onClick={undo} disabled={saving}>
            {t("undo")}
          </Button>
          <Button type="submit" loading={saving} disabled={graceInvalid || repeatDaysInvalid || noWorkingDay || locationInvalid}>
            {t("save")}
          </Button>
        </div>
      ) : null}
    </form>
  );
};

export default AttendanceSettingsPage;
