"use client";

import { useTranslations } from "next-intl";
import useApiData from "@/component/Homework/useApiData";
import { Button, Card, ErrorState, Skeleton } from "@/design/ui";
import useFormat from "@/i18n/useFormat";
import { IELTS_MODULES } from "./bands";
import { orderedCriteria } from "./groupTypes";

type TaskMarks = { part_no: number; band: number; criteria?: Record<string, number>; comment?: string | null };

/**
 * The one-page band report (P10-07, IEL-10) for a student and a test: module bands, the overall
 * band, Writing and Speaking criteria with comments, and progress against the target. Printed by
 * the browser.
 */
const BandReport = ({ assignmentId, studentId }: { assignmentId: string; studentId: string }) => {
  const t = useTranslations("ieltsReport");
  const tt = useTranslations("ieltsTests");
  const tk = useTranslations("ieltsTake");
  const format = useFormat();
  const { data, failed, reload } = useApiData<IeltsBandReport>(`/ielts/report/${assignmentId}/${studentId}`);
  if (failed !== null) return <ErrorState title={failed === 404 ? t("notFound") : t("loadFailed")} onRetry={reload} />;
  if (!data) {
    return (
      <Card aria-busy="true">
        <Skeleton lines={8} />
      </Card>
    );
  }
  const band = (value: number | null | undefined) => (value === null || value === undefined ? "—" : format.number(value, { minimumFractionDigits: 1 }));
  const modules = IELTS_MODULES.filter((m) => data.modules[m]);
  const criteriaRow = (criteria: Record<string, number>) =>
    orderedCriteria(criteria)
      .map(([k, v]) => `${tk(`criteria.${k}` as "criteria.CC")} ${band(v)}`)
      .join(" · ");

  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-5 bg-surface p-6 print:p-0" aria-label={t("title")}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-title font-semibold text-ink">{t("title")}</h1>
          <p className="text-body-sm text-ink-muted">
            {data.student.full_name}
            {data.student.batch ? ` · ${data.student.batch}` : ""}
          </p>
          <p className="text-body-sm text-ink-muted">
            {data.test.title} · {tt(`types.${data.test.test_type}`)} · {format.date(data.window.opens_at, { dateStyle: "medium" })}
          </p>
        </div>
        <Button className="print:hidden" variant="secondary" onClick={() => window.print()}>
          {t("print")}
        </Button>
      </div>
      <table className="w-full border-collapse text-body-sm">
        <caption className="sr-only">{t("bandsCaption")}</caption>
        <thead>
          <tr className="border-b border-border text-left text-ink-muted">
            <th className="py-2 font-medium">{t("module")}</th>
            <th className="py-2 text-right font-medium">{t("band")}</th>
            <th className="py-2 text-right font-medium">{t("target")}</th>
          </tr>
        </thead>
        <tbody>
          {modules.map((m) => {
            const row = data.modules[m];
            return (
              <tr key={m} className="border-b border-border">
                <td className="py-2 text-ink">
                  {tt(`modulesShort.${m}`)}
                  {row?.raw_score !== null && row?.raw_score !== undefined ? <span className="ms-2 text-ink-muted">{tk("scoreOutOf", { score: row.raw_score, total: row.raw_total ?? 40 })}</span> : null}
                  {row && row.band === null ? <span className="ms-2 text-ink-muted">{t("notMarked")}</span> : null}
                </td>
                <td className="py-2 text-right font-semibold text-ink">{band(row?.band)}</td>
                <td className="py-2 text-right text-ink-muted">{band(data.targets.bands[m] ?? data.targets.overall)}</td>
              </tr>
            );
          })}
          <tr>
            <td className="py-2 font-semibold text-ink">{t("overall")}</td>
            <td className="py-2 text-right text-title-sm font-semibold text-ink">{band(data.overall)}</td>
            <td className="py-2 text-right text-ink-muted">{band(data.targets.overall)}</td>
          </tr>
        </tbody>
      </table>
      {(["WRITING", "SPEAKING"] as const).map((m) => {
        const row = data.modules[m];
        if (!row?.criteria) return null;
        const tasks = ((row.criteria as { tasks?: TaskMarks[] }).tasks ?? []) as TaskMarks[];
        const speaking = (row.criteria as { speaking?: Record<string, number> }).speaking;
        return (
          <section key={m} className="flex flex-col gap-2">
            <h2 className="text-body font-semibold text-ink">{tt(`modulesShort.${m}`)}</h2>
            {tasks.map((task) => (
              <div key={task.part_no} className="text-body-sm text-ink">
                <p className="font-medium">{tk("taskBand", { band: band(task.band) })} · {tt("partNames.WRITING", { no: task.part_no })}</p>
                {task.criteria ? <p className="text-ink-muted">{criteriaRow(task.criteria)}</p> : null}
                {task.comment ? <p className="whitespace-pre-line">{task.comment}</p> : null}
              </div>
            ))}
            {speaking ? <p className="text-body-sm text-ink-muted">{criteriaRow(speaking)}</p> : null}
            {row.feedback ? <p className="whitespace-pre-line text-body-sm text-ink">{row.feedback}</p> : null}
          </section>
        );
      })}
      {data.test_date ? <p className="text-body-sm text-ink-muted">{t("testDate", { date: format.date(`${data.test_date}T00:00:00`, { dateStyle: "medium" }) })}</p> : null}
    </article>
  );
};

export default BandReport;
