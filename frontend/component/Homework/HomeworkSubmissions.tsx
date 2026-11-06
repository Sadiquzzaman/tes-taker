"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button, Card, Drawer, EmptyState, ErrorState, Skeleton, StatusPill, Table, type TableColumn } from "@/design/ui";
import useFormat from "@/i18n/useFormat";
import useApiData from "./useApiData";

/**
 * Staff's view of who handed a homework in (HW-03; HW-06 adds counts and reminders): every student it
 * is set to with their latest hand-in, and each student's versions with the answer and files.
 */
const HomeworkSubmissions = ({ homework }: { homework: HomeworkItem }) => {
  const t = useTranslations("homework.submissions");
  const tWork = useTranslations("homework.myWork");
  const format = useFormat();
  const { data: rows, failed, reload } = useApiData<StudentSubmissionRow[]>(`/homework/${homework.id}/submissions`);
  const [open, setOpen] = useState<StudentSubmissionRow | null>(null);

  if (homework.submission_type === "PAPER" || homework.status === "DRAFT" || homework.status === "SCHEDULED") return null;

  const columns: TableColumn<StudentSubmissionRow>[] = [
    {
      key: "student",
      header: t("student"),
      cell: (row) => (row.student.roll_no ? `${row.student.roll_no}. ${row.student.full_name}` : row.student.full_name),
    },
    {
      key: "state",
      header: t("state"),
      cell: (row) =>
        row.latest ? (
          <span className="flex flex-wrap gap-1">
            <StatusPill tone="success">{t("handedIn")}</StatusPill>
            {row.latest.is_late ? <StatusPill tone="warning">{tWork("late", { minutes: row.latest.late_minutes ?? 0 })}</StatusPill> : null}
          </span>
        ) : (
          <StatusPill tone="neutral">{t("missing")}</StatusPill>
        ),
    },
    { key: "when", header: t("when"), cell: (row) => (row.latest ? format.dateTime(row.latest.submitted_at) : "—"), hideOnMobile: true },
    { key: "versions", header: t("versions"), align: "right", cell: (row) => format.number(row.versions), hideOnMobile: true },
    {
      key: "open",
      header: t("actions"),
      align: "right",
      cell: (row) =>
        row.latest ? (
          <Button size="sm" variant="ghost" onClick={() => setOpen(row)} aria-label={t("openFor", { name: row.student.full_name })}>
            {t("open")}
          </Button>
        ) : null,
    },
  ];

  const handedIn = rows?.filter((row) => row.latest).length ?? 0;

  return (
    <Card title={t("title")} description={rows ? t("summary", { handedIn, total: rows.length }) : undefined} flush>
      {failed !== null ? (
        <ErrorState title={t("loadFailed")} onRetry={reload} />
      ) : rows === null ? (
        <div className="p-4" aria-busy="true">
          <Skeleton lines={4} />
        </div>
      ) : (
        <Table caption={t("title")} columns={columns} rows={rows} getRowId={(row) => row.student.id} empty={<EmptyState title={t("empty")} />} />
      )}
      {open?.latest ? <SubmissionDrawer homeworkId={homework.id} row={open} onClose={() => setOpen(null)} /> : null}
    </Card>
  );
};

const SubmissionDrawer = ({ homeworkId, row, onClose }: { homeworkId: string; row: StudentSubmissionRow; onClose: () => void }) => {
  const t = useTranslations("homework.myWork");
  const format = useFormat();
  const { data } = useApiData<SubmissionDetail>(`/homework/${homeworkId}/submissions/${row.latest?.id}`);
  return (
    <Drawer open onClose={onClose} title={row.student.full_name} wide>
      {!data ? (
        <Skeleton lines={5} />
      ) : (
        <ul className="flex flex-col gap-3">
          {data.versions.map((submission) => (
            <li key={submission.id} className="flex flex-col gap-2 rounded-input border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-ink">{t("version", { version: submission.version })}</span>
                <span className="text-body-sm text-ink-muted">{format.dateTime(submission.submitted_at)}</span>
                {submission.is_late ? <StatusPill tone="warning">{t("late", { minutes: submission.late_minutes ?? 0 })}</StatusPill> : null}
              </div>
              {submission.text_answer ? <p className="whitespace-pre-wrap text-body text-ink">{submission.text_answer}</p> : null}
              {submission.files.map((file) => (
                <a key={file.id} href={`${process.env.NEXT_PUBLIC_BASE_URL}/files/${file.id}/content`} target="_blank" rel="noreferrer" className="text-primary underline">
                  {file.name ?? t("file")}
                </a>
              ))}
            </li>
          ))}
        </ul>
      )}
    </Drawer>
  );
};

export default HomeworkSubmissions;
