"use client";

import { useTranslations } from "next-intl";
import NextLink from "next/link";
import { useState } from "react";
import useApiData from "@/component/Homework/useApiData";
import useIsStudent from "@/component/Homework/useIsStudent";
import { useToast } from "@/component/Toast/ToastContext";
import { Button, Card, EmptyState, ErrorState, PageHeader, Skeleton, StatusPill, Table, type TableColumn } from "@/design/ui";
import { cn, focusRing } from "@/design/ui/cn";
import useFormat from "@/i18n/useFormat";
import PaperExamDrawer from "./PaperExamDrawer";

/** "72.5/100 · 72.5% (A)" */
export const useScoreText = () => {
  const format = useFormat();
  return (marks: number | null, total: number, percent: number | null, grade: { grade: string } | null) =>
    marks === null ? "—" : `${format.number(marks)}/${format.number(total)} · ${format.number(percent ?? 0)}%${grade ? ` (${grade.grade})` : ""}`;
};

/**
 * Paper exams (P7-01, PRF-03): staff see the exams they manage and add new ones; a row opens the
 * marks grid. Students see their published paper-exam results.
 */
const MarksPage = () => {
  const isStudent = useIsStudent();
  if (isStudent === undefined) {
    return (
      <Card aria-busy="true">
        <Skeleton lines={4} />
      </Card>
    );
  }
  return isStudent ? <StudentResults /> : <StaffExams />;
};

const StudentResults = () => {
  const t = useTranslations("marks");
  const format = useFormat();
  const score = useScoreText();
  const { data: results, failed, reload } = useApiData<MyPaperResult[]>("/offline-exams/mine");
  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader title={t("myTitle")} description={t("myIntro")} />
      {failed !== null ? (
        <ErrorState title={t("loadFailed")} onRetry={reload} />
      ) : results === null ? (
        <Card aria-busy="true">
          <Skeleton lines={4} />
        </Card>
      ) : results.length === 0 ? (
        <Card>
          <EmptyState title={t("myEmpty")} description={t("myEmptyHint")} />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {results.map((result) => (
            <li key={result.exam.id} className="flex flex-col gap-1 rounded-card border border-border bg-surface p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
              <span className="flex min-w-0 flex-col gap-1">
                <span className="truncate text-title-sm font-semibold text-ink">{result.exam.name}</span>
                <span className="text-body-sm text-ink-muted">
                  {[result.exam.subject.name, format.date(`${result.exam.exam_date}T00:00:00Z`, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }), result.exam.term?.name].filter(Boolean).join(" · ")}
                </span>
              </span>
              {result.is_absent ? (
                <StatusPill tone="neutral">{t("absent")}</StatusPill>
              ) : (
                <span className="text-body font-medium text-ink">{score(result.marks, result.exam.total_marks, result.percent, result.grade)}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const StaffExams = () => {
  const t = useTranslations("marks");
  const format = useFormat();
  const { triggerToast } = useToast();
  const [adding, setAdding] = useState(false);
  const { data: exams, failed, reload } = useApiData<PaperExam[]>("/offline-exams");

  const columns: TableColumn<PaperExam>[] = [
    {
      key: "name",
      header: t("columns.name"),
      cell: (row) => (
        <NextLink href={`/marks/${row.id}`} className={cn("font-medium text-primary underline-offset-2 hover:underline", focusRing)}>
          {row.name}
        </NextLink>
      ),
      sortValue: (row) => row.name,
    },
    { key: "subject", header: t("columns.subject"), cell: (row) => row.offering.subject.name, sortValue: (row) => row.offering.subject.name },
    {
      key: "section",
      header: t("columns.section"),
      cell: (row) => `${row.offering.section.class_name ?? ""} ${row.offering.section.name}`.trim(),
      sortValue: (row) => `${row.offering.section.class_name ?? ""} ${row.offering.section.name}`,
    },
    { key: "date", header: t("columns.date"), cell: (row) => format.date(`${row.exam_date}T00:00:00Z`, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }), sortValue: (row) => row.exam_date, hideOnMobile: true },
    { key: "total", header: t("columns.total"), align: "right", cell: (row) => format.number(row.total_marks), hideOnMobile: true },
    {
      key: "entered",
      header: t("columns.entered"),
      align: "right",
      cell: (row) => t("entered", { entered: row.counts.entered, students: row.counts.students }),
      hideOnMobile: true,
    },
    {
      key: "status",
      header: t("columns.status"),
      cell: (row) => <StatusPill tone={row.published_at ? "success" : "neutral"}>{t(row.published_at ? "published" : "notPublished")}</StatusPill>,
    },
  ];

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader title={t("title")} description={t("intro")} actions={<Button onClick={() => setAdding(true)}>{t("add")}</Button>} />
      <Card flush>
        {failed !== null ? (
          <ErrorState title={t("loadFailed")} onRetry={reload} />
        ) : exams === null ? (
          <div className="p-4" aria-busy="true">
            <Skeleton lines={5} />
          </div>
        ) : (
          <Table
            caption={t("title")}
            columns={columns}
            rows={exams}
            getRowId={(row) => row.id}
            defaultSort={{ key: "date", direction: "desc" }}
            empty={<EmptyState title={t("empty")} description={t("emptyHint")} />}
          />
        )}
      </Card>
      <PaperExamDrawer
        open={adding}
        exam={null}
        onClose={() => setAdding(false)}
        onSaved={(exam) => {
          setAdding(false);
          triggerToast({ title: t("created"), description: t("createdHint", { name: exam.name }), type: "success" });
          reload();
        }}
      />
    </div>
  );
};

export default MarksPage;
