"use client";

import { AxiosError } from "axios";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import useApiData from "@/component/Homework/useApiData";
import { useToast } from "@/component/Toast/ToastContext";
import { Button, Card, DatePicker, EmptyState, ErrorState, Input, PageHeader, Select, Skeleton } from "@/design/ui";
import { useApiError } from "@/hooks/api/useApiError";
import useWorkspace from "@/hooks/organization/useWorkspace";
import axiosReq from "@/lib/axios";
import { todayInSchool } from "@/utils/schoolDate";
import CriteriaDrawer from "./CriteriaDrawer";

type Draft = { ratings: Record<string, string>; remark: string };

const draftOf = (row: BehaviourGrid["rows"][number]): Draft => ({
  ratings: Object.fromEntries(Object.entries(row.ratings).map(([id, value]) => [id, String(value)])),
  remark: row.remark ?? "",
});

/**
 * Class behaviour (PRF-04): choose a subject and a day, then rate each student 1–5 on each
 * criterion, with a remark if needed. Rate as often as you like; the term average counts. Owners
 * and admins change the criteria.
 */
const BehaviourPage = () => {
  const t = useTranslations("behaviour");
  const { triggerToast } = useToast();
  const { memberRole, isIndividual } = useWorkspace();
  const { data: classes, failed, reload } = useApiData<PaperSubjectClass[]>("/offline-exams/subject-classes");
  const [offeringId, setOfferingId] = useState("");
  const [date, setDate] = useState(todayInSchool());
  const [editingCriteria, setEditingCriteria] = useState(false);
  const [version, setVersion] = useState(0);
  const current = offeringId || classes?.[0]?.offering_id || "";
  const canEditCriteria = isIndividual || memberRole === "OWNER" || memberRole === "ADMIN";

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader
        title={t("title")}
        description={t("intro")}
        actions={
          canEditCriteria ? (
            <Button variant="secondary" onClick={() => setEditingCriteria(true)}>
              {t("criteria")}
            </Button>
          ) : undefined
        }
      />
      {failed !== null ? (
        <ErrorState title={t("loadFailed")} onRetry={reload} />
      ) : classes === null ? (
        <Card aria-busy="true">
          <Skeleton lines={4} />
        </Card>
      ) : classes.length === 0 ? (
        <Card>
          <EmptyState title={t("noClasses")} description={t("noClassesHint")} />
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <Select
              label={t("subjectClass")}
              fieldClassName="sm:w-72"
              placeholder={false}
              value={current}
              onChange={(event) => setOfferingId(event.target.value)}
              options={classes.map((item) => ({ value: item.offering_id, label: `${item.subject.name} · ${item.section_label}` }))}
            />
            <DatePicker label={t("date")} value={date} max={todayInSchool()} onChange={(value) => value && setDate(value)} />
          </div>
          <RatingsGrid key={version} offeringId={current} date={date} />
        </>
      )}
      <CriteriaDrawer
        open={editingCriteria}
        onClose={() => setEditingCriteria(false)}
        onSaved={() => {
          setEditingCriteria(false);
          triggerToast({ title: t("criteriaSaved"), type: "success" });
          setVersion((value) => value + 1);
        }}
      />
    </div>
  );
};

/** One subject class on one day: students × criteria. Only changed students are sent. */
const RatingsGrid = ({ offeringId, date }: { offeringId: string; date: string }) => {
  const t = useTranslations("behaviour");
  const locale = useLocale();
  const { triggerToast } = useToast();
  const { handleError } = useApiError();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const { data: grid, failed, reload, setData } = useApiData<BehaviourGrid>("/behaviour/grid", { offering_id: offeringId, date });
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (grid) setDrafts(Object.fromEntries(grid.rows.map((row) => [row.student.id, draftOf(row)])));
    setError(null);
  }, [grid]);

  const changed = useMemo(() => (grid ? grid.rows.filter((row) => JSON.stringify(drafts[row.student.id]) !== JSON.stringify(draftOf(row))) : []), [drafts, grid]);
  const nameOf = (criterion: BehaviourCriterion) => (locale === "bn" ? criterion.name_bn : criterion.name_en);

  const save = async () => {
    if (!grid) return;
    setSaving(true);
    setError(null);
    try {
      const rows = changed.map((row) => ({
        student_id: row.student.id,
        ratings: Object.fromEntries(Object.entries(drafts[row.student.id].ratings).map(([id, value]) => [id, value === "" ? null : Number(value)])),
        remark: drafts[row.student.id].remark.trim() || null,
      }));
      const response = await axiosReq.put<ApiResponse<BehaviourGrid>>(`${baseUrl}/behaviour/grid`, { offering_id: grid.offering.id, date, rows });
      setData(response.data.payload);
      triggerToast({ title: t("saved"), type: "success" });
    } catch (err) {
      const code = (err as AxiosError<ApiError & { code?: string }>).response?.data?.code;
      if (code?.startsWith("RESULTS_")) setError(t(`errors.${code}` as never));
      else handleError(err as AxiosError<ApiError>);
    } finally {
      setSaving(false);
    }
  };

  if (failed !== null) return <ErrorState title={t("loadFailed")} onRetry={reload} />;
  if (!grid) {
    return (
      <Card aria-busy="true">
        <Skeleton lines={6} />
      </Card>
    );
  }
  return (
    <>
      <Card flush>
        <div className="overflow-x-auto">
          <table className="w-full text-body-sm">
            <caption className="sr-only">{t("gridCaption")}</caption>
            <thead>
              <tr className="border-b border-border text-left text-caption text-ink-muted">
                <th scope="col" className="px-3 py-2">
                  {t("student")}
                </th>
                {grid.criteria.map((criterion) => (
                  <th key={criterion.id} scope="col" className="px-3 py-2">
                    {nameOf(criterion)}
                  </th>
                ))}
                <th scope="col" className="px-3 py-2">
                  {t("remark")}
                </th>
              </tr>
            </thead>
            <tbody>
              {grid.rows.map((row) => {
                const draft = drafts[row.student.id];
                if (!draft) return null;
                return (
                  <tr key={row.student.id} className="border-b border-border last:border-0">
                    <th scope="row" className="px-3 py-2 text-left font-medium text-ink">
                      {row.student.roll_no ? `${row.student.roll_no}. ` : ""}
                      {row.student.full_name}
                    </th>
                    {grid.criteria.map((criterion) => (
                      <td key={criterion.id} className="px-3 py-2">
                        <Select
                          label={t("ratingFor", { criterion: nameOf(criterion), name: row.student.full_name })}
                          hideLabel
                          fieldClassName="w-20"
                          placeholder={row.ratings[criterion.id] === undefined ? "—" : false}
                          disabled={!grid.can_edit}
                          value={draft.ratings[criterion.id] ?? ""}
                          options={[1, 2, 3, 4, 5].map((value) => ({ value: String(value), label: String(value) }))}
                          onChange={(event) =>
                            setDrafts((all) => ({ ...all, [row.student.id]: { ...all[row.student.id], ratings: { ...all[row.student.id].ratings, [criterion.id]: event.target.value } } }))
                          }
                        />
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      <Input
                        label={t("remarkFor", { name: row.student.full_name })}
                        hideLabel
                        maxLength={300}
                        fieldClassName="min-w-48"
                        disabled={!grid.can_edit}
                        value={draft.remark}
                        onChange={(event) => setDrafts((all) => ({ ...all, [row.student.id]: { ...all[row.student.id], remark: event.target.value } }))}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {grid.rows.length === 0 ? <EmptyState title={t("noStudents")} /> : null}
      </Card>
      <p className="text-body-sm text-ink-muted">{t("scale")}</p>
      {error ? (
        <p role="alert" className="text-body-sm text-danger">
          {error}
        </p>
      ) : null}
      {grid.can_edit ? (
        <div className="flex items-center justify-end gap-3">
          <span className="text-body-sm text-ink-muted">{t("unsaved", { count: changed.length })}</span>
          <Button loading={saving} disabled={changed.length === 0} onClick={() => void save()}>
            {t("save")}
          </Button>
        </div>
      ) : (
        <p className="text-body-sm text-ink-muted">{t("readOnly")}</p>
      )}
    </>
  );
};

export default BehaviourPage;
