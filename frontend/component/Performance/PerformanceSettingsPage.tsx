"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import useApiData from "@/component/Homework/useApiData";
import { useToast } from "@/component/Toast/ToastContext";
import { Button, Card, Checkbox, EmptyState, ErrorState, Input, Link, PageHeader, Select, Skeleton, Tag } from "@/design/ui";
import { useApiError } from "@/hooks/api/useApiError";
import useBillingAccess from "@/hooks/organization/useBillingAccess";
import useFormat from "@/i18n/useFormat";
import axiosReq from "@/lib/axios";

const PARTS = ["exams_pct", "homework_pct", "attendance_pct", "behaviour_pct"] as const;
type Part = (typeof PARTS)[number];
type Draft = Record<Part, string>;

const draftOf = (weights: ScoreWeightValues): Draft => Object.fromEntries(PARTS.map((part) => [part, String(weights[part])])) as Draft;
const sumOf = (draft: Draft) => PARTS.reduce((sum, part) => sum + (Number(draft[part]) || 0), 0);
const validDraft = (draft: Draft) => PARTS.every((part) => /^\d{1,3}$/.test(draft[part]) && Number(draft[part]) <= 100) && sumOf(draft) === 100;

/**
 * Performance settings (P7-02): how much exams, homework, attendance and behaviour count in each
 * class's score for a session (PRF-01), when a student is at risk on the class dashboard (PRF-07),
 * and whether students see their position (PRF-10). Owners and admins change them (a solo teacher
 * in their own workspace); other staff see them read-only. The behaviour criteria are on the
 * Behaviour page.
 */
const PerformanceSettingsPage = () => {
  const t = useTranslations("performanceSettings");
  const { canManageBilling: canEdit } = useBillingAccess();
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 pb-8">
      <PageHeader title={t("title")} description={canEdit ? t("intro") : t("readOnly")} />
      <WeightsCard canEdit={canEdit} />
      <AtRiskCard canEdit={canEdit} />
      <p className="text-body-sm text-ink-muted">
        {t("criteriaHint")}{" "}
        <Link href="/behaviour">{t("criteriaLink")}</Link>
      </p>
    </div>
  );
};

const WeightsCard = ({ canEdit }: { canEdit: boolean }) => {
  const t = useTranslations("performanceSettings");
  const format = useFormat();
  const { triggerToast } = useToast();
  const { handleError } = useApiError();
  const { data: sessions } = useApiData<AcademicSession[]>("/sessions");
  const [sessionId, setSessionId] = useState("");
  const { data, failed, reload, setData } = useApiData<SessionScoreWeights>("/scores/weights", { session_id: sessionId || undefined });
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (data) setDrafts(Object.fromEntries(data.classes.map((row) => [row.class.id, draftOf(row.weights)])));
  }, [data]);

  const editable = canEdit && data !== null && !data.session.closed;

  const save = async (classId: string) => {
    if (!data) return;
    const draft = drafts[classId];
    setSaving(classId);
    try {
      const body = { session_id: data.session.id, class_id: classId, ...Object.fromEntries(PARTS.map((part) => [part, Number(draft[part])])) };
      const response = await axiosReq.put<ApiResponse<SessionScoreWeights>>(`${process.env.NEXT_PUBLIC_BASE_URL}/scores/weights`, body);
      setData(response.data.payload);
      triggerToast({ title: t("weightsSaved"), type: "success" });
    } catch (err) {
      handleError(err as AxiosError<ApiError>);
    } finally {
      setSaving(null);
    }
  };

  return (
    <Card>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="text-title-sm font-semibold text-ink">{t("weightsTitle")}</h2>
            <p className="text-body-sm text-ink-muted">{t("weightsIntro")}</p>
          </div>
          {sessions && sessions.length > 1 ? (
            <Select
              label={t("session")}
              fieldClassName="sm:w-56"
              placeholder={false}
              value={sessionId || data?.session.id || ""}
              onChange={(event) => setSessionId(event.target.value)}
              options={sessions.map((session) => ({ value: session.id, label: session.name }))}
            />
          ) : null}
        </div>
        {failed !== null ? (
          <ErrorState title={t("loadFailed")} onRetry={reload} />
        ) : !data ? (
          <Skeleton lines={4} />
        ) : data.classes.length === 0 ? (
          <EmptyState title={t("noClasses")} description={t("noClassesHint")} />
        ) : (
          <>
            {data.session.closed ? <p className="text-body-sm text-ink-muted">{t("sessionClosed")}</p> : null}
            <div className="overflow-x-auto">
              <table className="w-full text-body-sm">
                <caption className="sr-only">{t("weightsCaption", { session: data.session.name })}</caption>
                <thead>
                  <tr className="border-b border-border text-left text-caption text-ink-muted">
                    <th scope="col" className="px-2 py-2">
                      {t("class")}
                    </th>
                    {PARTS.map((part) => (
                      <th key={part} scope="col" className="px-2 py-2">
                        {t(`parts.${part}`)}
                      </th>
                    ))}
                    <th scope="col" className="px-2 py-2 text-right">
                      {t("total")}
                    </th>
                    {editable ? (
                      <th scope="col" className="px-2 py-2">
                        <span className="sr-only">{t("actions")}</span>
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {data.classes.map((row) => {
                    const draft = drafts[row.class.id];
                    if (!draft) return null;
                    const sum = sumOf(draft);
                    const changed = JSON.stringify(draft) !== JSON.stringify(draftOf(row.weights));
                    return (
                      <tr key={row.class.id} className="border-b border-border last:border-0">
                        <th scope="row" className="px-2 py-2 text-left font-medium text-ink">
                          <span className="flex flex-wrap items-center gap-2">
                            {row.class.name}
                            {row.is_default ? <Tag>{t("default")}</Tag> : null}
                          </span>
                        </th>
                        {PARTS.map((part) => (
                          <td key={part} className="px-2 py-2">
                            <Input
                              label={t("partFor", { part: t(`parts.${part}`), name: row.class.name })}
                              hideLabel
                              type="number"
                              min={0}
                              max={100}
                              fieldClassName="w-20"
                              disabled={!editable}
                              value={draft[part]}
                              onChange={(event) => setDrafts((all) => ({ ...all, [row.class.id]: { ...all[row.class.id], [part]: event.target.value } }))}
                            />
                          </td>
                        ))}
                        <td className={sum === 100 ? "px-2 py-2 text-right text-ink" : "px-2 py-2 text-right font-medium text-danger"}>{`${format.number(sum)}%`}</td>
                        {editable ? (
                          <td className="px-2 py-2 text-right">
                            <Button
                              size="sm"
                              variant="secondary"
                              loading={saving === row.class.id}
                              disabled={!changed || !validDraft(draft) || saving !== null}
                              aria-label={t("saveFor", { name: row.class.name })}
                              onClick={() => void save(row.class.id)}
                            >
                              {t("save")}
                            </Button>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-body-sm text-ink-muted" aria-live="polite">
              {Object.values(drafts).some((draft) => sumOf(draft) !== 100) ? t("mustAddUp") : t("weightsHint")}
            </p>
          </>
        )}
      </div>
    </Card>
  );
};

const AtRiskCard = ({ canEdit }: { canEdit: boolean }) => {
  const t = useTranslations("performanceSettings");
  const { triggerToast } = useToast();
  const { handleError } = useApiError();
  const { data, failed, reload, setData } = useApiData<PerformanceSettings>("/scores/settings");
  const [draft, setDraft] = useState<PerformanceSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const value = draft ?? data;

  if (failed !== null) return <ErrorState title={t("loadFailed")} onRetry={reload} />;
  if (!value) {
    return (
      <Card aria-busy="true">
        <Skeleton lines={4} />
      </Card>
    );
  }
  const limit = (key: keyof PerformanceSettings["at_risk"], raw: string) => setDraft({ ...value, at_risk: { ...value.at_risk, [key]: raw === "" ? Number.NaN : Number(raw) } });
  const invalid =
    !Number.isInteger(value.at_risk.score_pct) ||
    value.at_risk.score_pct < 0 ||
    value.at_risk.score_pct > 100 ||
    !Number.isInteger(value.at_risk.attendance_pct) ||
    value.at_risk.attendance_pct < 0 ||
    value.at_risk.attendance_pct > 100 ||
    !Number.isInteger(value.at_risk.missing_homework) ||
    value.at_risk.missing_homework < 1 ||
    value.at_risk.missing_homework > 50;

  const save = async () => {
    setSaving(true);
    try {
      const response = await axiosReq.put<ApiResponse<PerformanceSettings>>(`${process.env.NEXT_PUBLIC_BASE_URL}/scores/settings`, value);
      setData(response.data.payload);
      setDraft(null);
      triggerToast({ title: t("settingsSaved"), type: "success" });
    } catch (err) {
      handleError(err as AxiosError<ApiError>);
    } finally {
      setSaving(false);
    }
  };

  const shown = (n: number) => (Number.isNaN(n) ? "" : String(n));
  return (
    <Card>
      <fieldset className="flex flex-col gap-4" disabled={!canEdit}>
        <legend className="mb-1 text-title-sm font-semibold text-ink">{t("atRiskTitle")}</legend>
        <p className="text-body-sm text-ink-muted">{t("atRiskIntro")}</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Input label={t("scoreBelow")} type="number" min={0} max={100} value={shown(value.at_risk.score_pct)} onChange={(event) => limit("score_pct", event.target.value)} />
          <Input label={t("attendanceBelow")} type="number" min={0} max={100} value={shown(value.at_risk.attendance_pct)} onChange={(event) => limit("attendance_pct", event.target.value)} />
          <Input label={t("missingHomework")} type="number" min={1} max={50} value={shown(value.at_risk.missing_homework)} onChange={(event) => limit("missing_homework", event.target.value)} />
        </div>
        {invalid ? (
          <p role="alert" className="text-body-sm text-danger">
            {t("limitsInvalid")}
          </p>
        ) : null}
        <Checkbox label={t("showRank")} hint={t("showRankHint")} checked={value.show_rank} onChange={(event) => setDraft({ ...value, show_rank: event.target.checked })} />
      </fieldset>
      {canEdit ? (
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" disabled={!draft || saving} onClick={() => setDraft(null)}>
            {t("undo")}
          </Button>
          <Button loading={saving} disabled={!draft || saving || invalid} onClick={() => void save()}>
            {t("saveSettings")}
          </Button>
        </div>
      ) : null}
    </Card>
  );
};

export default PerformanceSettingsPage;
