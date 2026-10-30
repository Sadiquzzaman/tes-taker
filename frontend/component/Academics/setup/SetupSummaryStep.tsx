"use client";

import { useTranslations } from "next-intl";
import { Card, StatusPill, Table, type TableColumn } from "@/design/ui";
import useFormat from "@/i18n/useFormat";

type SetupClass = AcademicSetupSummary["classes"][number];

/** Step 5: what was set up, with what still needs attention, before finishing. */
const SetupSummaryStep = ({ summary }: { summary: AcademicSetupSummary }) => {
  const t = useTranslations("academics.setup.summary");
  const format = useFormat();
  const noSection = summary.classes.filter((c) => c.section_count === 0);
  const noSubjects = summary.classes.filter((c) => c.subject_count === 0);

  const columns: TableColumn<SetupClass>[] = [
    { key: "name", header: t("class"), cell: (row) => row.name, sortValue: (row) => row.name },
    { key: "subjects", header: t("subjects"), align: "right", cell: (row) => format.number(row.subject_count), sortValue: (row) => row.subject_count },
    { key: "sections", header: t("sections"), align: "right", cell: (row) => format.number(row.section_count), sortValue: (row) => row.section_count },
    {
      key: "status",
      header: t("status"),
      cell: (row) =>
        row.section_count === 0 ? (
          <StatusPill tone="danger">{t("needsSection")}</StatusPill>
        ) : row.subject_count === 0 ? (
          <StatusPill tone="warning">{t("noSubjects")}</StatusPill>
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
        {summary.classes.length > 0 ? (
          <Table caption={t("title")} columns={columns} rows={summary.classes} getRowId={(row) => row.id} defaultSort={{ key: "name", direction: "asc" }} />
        ) : null}
      </div>
    </Card>
  );
};

export default SetupSummaryStep;
