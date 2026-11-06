"use client";

import { useTranslations } from "next-intl";
import NextLink from "next/link";
import { useState } from "react";
import { useToast } from "@/component/Toast/ToastContext";
import { Button, Card, EmptyState, ErrorState, PageHeader, Select, Skeleton, StatusPill, Table, type TableColumn } from "@/design/ui";
import { cn, focusRing } from "@/design/ui/cn";
import useFormat from "@/i18n/useFormat";
import HomeworkEditor from "./HomeworkEditor";
import { classesLabel, DUE_TONE, dueState, STATUS_TONE } from "./homeworkFormat";
import useApiData from "./useApiData";
import useIsStudent from "./useIsStudent";

/**
 * Homework (Epic 2): students see their to-do list (published homework set to them, soonest due
 * first); staff see the homework they manage and write new ones.
 */
const HomeworkPage = () => {
  const isStudent = useIsStudent();
  if (isStudent === undefined) {
    return (
      <Card aria-busy="true">
        <Skeleton lines={4} />
      </Card>
    );
  }
  return isStudent ? <StudentHomework /> : <StaffHomework />;
};

const StudentHomework = () => {
  const t = useTranslations("homework");
  const format = useFormat();
  const { data: items, failed, reload } = useApiData<HomeworkItem[]>("/homework/mine");

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader title={t("title")} description={t("studentIntro")} />
      {failed !== null ? (
        <ErrorState title={t("loadFailed")} onRetry={reload} />
      ) : items === null ? (
        <Card aria-busy="true">
          <Skeleton lines={4} />
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState title={t("studentEmpty")} description={t("studentEmptyHint")} />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => {
            const due = dueState(item.due_at);
            return (
              <li key={item.id}>
                <NextLink
                  href={`/homework/${item.id}`}
                  className={cn("flex flex-col gap-2 rounded-card border border-border bg-surface p-4 shadow-card hover:border-primary sm:flex-row sm:items-center sm:justify-between", focusRing)}
                >
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="truncate text-title-sm font-semibold text-ink">{item.title}</span>
                    <span className="text-body-sm text-ink-muted">{item.subject.name}</span>
                  </span>
                  {item.my_submission ? (
                    <StatusPill tone="success">{t("handedIn", { version: item.my_submission.version })}</StatusPill>
                  ) : (
                    <StatusPill tone={DUE_TONE[due]}>{item.due_at ? t(`due.${due}`, { when: format.dateTime(item.due_at) }) : t("due.none")}</StatusPill>
                  )}
                </NextLink>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

const StaffHomework = () => {
  const t = useTranslations("homework");
  const format = useFormat();
  const { triggerToast } = useToast();
  const [status, setStatus] = useState("ACTIVE");
  const [editing, setEditing] = useState(false);
  const { data: items, failed, reload } = useApiData<HomeworkItem[]>("/homework", { status });

  const columns: TableColumn<HomeworkItem>[] = [
    {
      key: "title",
      header: t("columns.title"),
      cell: (row) => (
        <NextLink href={`/homework/${row.id}`} className={cn("font-medium text-primary underline-offset-2 hover:underline", focusRing)}>
          {row.title}
        </NextLink>
      ),
    },
    { key: "subject", header: t("columns.subject"), cell: (row) => row.subject.name },
    { key: "classes", header: t("columns.classes"), cell: (row) => classesLabel(row), hideOnMobile: true },
    { key: "due", header: t("columns.due"), cell: (row) => (row.due_at ? format.dateTime(row.due_at) : "—"), hideOnMobile: true },
    { key: "students", header: t("columns.students"), align: "right", cell: (row) => format.number(row.student_count), hideOnMobile: true },
    { key: "status", header: t("columns.status"), cell: (row) => <StatusPill tone={STATUS_TONE[row.status]}>{t(`statuses.${row.status}`)}</StatusPill> },
  ];

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader title={t("title")} description={t("staffIntro")} actions={<Button onClick={() => setEditing(true)}>{t("new")}</Button>} />
      <Select
        label={t("show")}
        fieldClassName="sm:w-56"
        placeholder={false}
        value={status}
        onChange={(event) => setStatus(event.target.value)}
        options={(["ACTIVE", "DRAFT", "SCHEDULED", "PUBLISHED", "CANCELLED"] as const).map((value) => ({ value, label: t(`filters.${value}`) }))}
      />
      <Card flush>
        {failed !== null ? (
          <ErrorState title={t("loadFailed")} onRetry={reload} />
        ) : items === null ? (
          <div className="p-4" aria-busy="true">
            <Skeleton lines={5} />
          </div>
        ) : (
          <Table caption={t("title")} columns={columns} rows={items} getRowId={(row) => row.id} empty={<EmptyState title={t("staffEmpty")} description={t("staffEmptyHint")} />} />
        )}
      </Card>
      <HomeworkEditor
        open={editing}
        homework={null}
        onClose={() => setEditing(false)}
        onSaved={(saved) => {
          setEditing(false);
          triggerToast({ title: t("savedTitle"), description: t(saved.status === "PUBLISHED" ? "published" : "savedDraft"), type: "success" });
          reload();
        }}
      />
    </div>
  );
};

export default HomeworkPage;
