"use client";

import { useTranslations } from "next-intl";
import { Card, Link, StatusPill, Table, type TableColumn } from "@/design/ui";
import useFormat from "@/i18n/useFormat";

type SetupClass = AcademicSetupSummary["classes"][number];

/**
 * Step 5: what was set up, with what still needs attention, before finishing: a [[class]] without
 * [[sections]] blocks finishing; subjects without a teacher, [[classes]] without students and a
 * missing check-in location are warnings with a link to where they are fixed.
 */
const SetupSummaryStep = ({ summary }: { summary: AcademicSetupSummary }) => {
  const t = useTranslations("academics.setup.summary");
  const format = useFormat();
  const noSection = summary.classes.filter((c) => c.section_count === 0);
  const noSubjects = summary.classes.filter((c) => c.subject_count === 0);
  const noTeacher = summary.classes.filter((c) => c.subjects_without_teacher.length > 0);
  const noStudents = summary.classes.filter((c) => c.section_count > 0 && c.student_count === 0);

  const columns: TableColumn<SetupClass>[] = [
    { key: "name", header: t("class"), cell: (row) => row.name, sortValue: (row) => row.name },
    { key: "subjects", header: t("subjects"), align: "right", cell: (row) => format.number(row.subject_count), sortValue: (row) => row.subject_count },
    { key: "sections", header: t("sections"), align: "right", cell: (row) => format.number(row.section_count), sortValue: (row) => row.section_count },
    { key: "students", header: t("students"), align: "right", cell: (row) => format.number(row.student_count), sortValue: (row) => row.student_count },
    {
      key: "status",
      header: t("status"),
      cell: (row) =>
        row.section_count === 0 ? (
          <StatusPill tone="danger">{t("needsSection")}</StatusPill>
        ) : row.subject_count === 0 ? (
          <StatusPill tone="warning">{t("noSubjects")}</StatusPill>
        ) : row.subjects_without_teacher.length > 0 ? (
          <StatusPill tone="warning">{t("needsTeacher")}</StatusPill>
        ) : row.student_count === 0 ? (
          <StatusPill tone="warning">{t("noStudents")}</StatusPill>
        ) : (
          <StatusPill tone="success">{t("ready")}</StatusPill>
        ),
    },
  ];

  return (
    <Card title={t("title")} description={t("session", { name: summary.session.name })}>
      <div className="flex flex-col gap-4">
        {summary.classes.length === 0 ? <p className="text-body-sm text-danger">{t("needsClass")}</p> : null}
        {noSection.length > 0 ? <p className="text-body-sm text-danger">{t("needsSectionDetail", { names: noSection.map((c) => c.name).join(", ") })}</p> : null}
        {noSubjects.length > 0 ? (
          <p className="text-body-sm text-ink-muted">{t("noSubjectsDetail", { names: noSubjects.map((c) => c.name).join(", ") })}</p>
        ) : null}
        {noTeacher.length > 0 ? (
          <div className="flex flex-col gap-1 text-body-sm text-ink">
            <p>{t("needsTeacherDetail")}</p>
            <ul className="list-disc ps-5 text-ink-muted">
              {noTeacher.map((c) => (
                <li key={c.id}>{`${c.name}: ${c.subjects_without_teacher.join(", ")}`}</li>
              ))}
            </ul>
            <Link href="/organization/assignments" className="self-start">
              {t("assignTeachers")}
            </Link>
          </div>
        ) : null}
        {noStudents.length > 0 ? (
          <div className="flex flex-col gap-1 text-body-sm text-ink">
            <p>{t("noStudentsDetail", { names: noStudents.map((c) => c.name).join(", ") })}</p>
            <Link href="/organization/students" className="self-start">
              {t("addStudents")}
            </Link>
          </div>
        ) : null}
        {summary.checkin_pin_missing ? (
          <div className="flex flex-col gap-1 text-body-sm text-ink">
            <p>{t("pinMissing")}</p>
            <Link href="/attendance-branches" className="self-start">
              {t("setPin")}
            </Link>
          </div>
        ) : null}
        {summary.classes.length > 0 ? (
          <Table caption={t("title")} columns={columns} rows={summary.classes} getRowId={(row) => row.id} defaultSort={{ key: "name", direction: "asc" }} />
        ) : null}
      </div>
    </Card>
  );
};

export default SetupSummaryStep;
