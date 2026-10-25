"use client";

import { useTranslations } from "next-intl";
import { Button, Card, EmptyState, FilterBar, Pagination, StatusPill, Table, type TableColumn } from "@/design/ui";
import useFormat from "@/i18n/useFormat";
import { setCurrentPage, setOpenModal, setSearchStudentInput, setSelectedSubmission } from "@/lib/features/gradeDetailsSlice";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";

/** Every submission for the test: open one to grade it, or to see its result. */
const StudentSubmissionsTable = () => {
  const t = useTranslations("grading.submissions");
  const tRoster = useTranslations("grading.roster");
  const format = useFormat();
  const dispatch = useAppDispatch();
  const { currentPage, searchStudentInput, submissions, totalPages } = useAppSelector((state) => state.gradeDetails);

  const open = (student: GradingSubmissionListItem) => {
    dispatch(setSelectedSubmission(student));
    dispatch(setOpenModal(student.is_graded ? "result" : "edit"));
  };

  const examStatusLabel = (status: string) => {
    const key = `${status}`.toLowerCase();
    return tRoster.has(key as "submitted") ? tRoster(key as "submitted") : status;
  };

  const columns: TableColumn<GradingSubmissionListItem>[] = [
    { key: "name", header: t("student"), cell: (row) => row.student_name || t("anonymous"), sortValue: (row) => row.student_name },
    { key: "contact", header: t("contact"), cell: (row) => row.email || row.phone || "—", hideOnMobile: true },
    {
      key: "submitted",
      header: t("submittedAt"),
      cell: (row) => (row.submitted_at ? format.dateTime(row.submitted_at) : "—"),
      sortValue: (row) => (row.submitted_at ? new Date(row.submitted_at) : null),
      className: "whitespace-nowrap",
    },
    { key: "exam", header: t("examStatus"), cell: (row) => <span title={row.disqualification_reason ?? undefined}>{examStatusLabel(row.status)}</span>, hideOnMobile: true },
    {
      key: "grading",
      header: t("grading"),
      cell: (row) => (
        <StatusPill tone={row.grading_status === "GRADED" ? "success" : "warning"}>{t(`gradeStatus.${row.grading_status}`)}</StatusPill>
      ),
      sortValue: (row) => row.grading_status,
    },
    {
      key: "score",
      header: t("score"),
      cell: (row) => (row.total_score === null || row.max_score === null ? "—" : `${format.number(row.total_score)} / ${format.number(row.max_score)}`),
      align: "right",
    },
    {
      key: "flags",
      header: t("violations"),
      cell: (row) => format.number(row.proctoring_summary?.total_violations ?? 0),
      sortValue: (row) => row.proctoring_summary?.total_violations ?? 0,
      align: "right",
    },
    {
      key: "action",
      header: t("action"),
      align: "right",
      cell: (row) => (
        <Button size="sm" variant={row.grading_status === "GRADED" ? "secondary" : "primary"} onClick={() => open(row)}>
          {row.grading_status === "GRADED" ? t("view") : t("start")}
        </Button>
      ),
    },
  ];

  return (
    <Card title={t("title")}>
      <div className="flex flex-col gap-4">
        <FilterBar search={searchStudentInput} onSearchChange={(value) => dispatch(setSearchStudentInput(value))} searchPlaceholder={t("search")} />
        <Table
          caption={t("title")}
          columns={columns}
          rows={submissions}
          getRowId={(row) => row.submission_id}
          empty={<EmptyState title={t("empty")} />}
        />
        <Pagination page={currentPage} pageCount={totalPages} onPageChange={(page) => dispatch(setCurrentPage(page))} />
      </div>
    </Card>
  );
};

export default StudentSubmissionsTable;
