"use client";

import NextLink from "next/link";
import { useTranslations } from "next-intl";
import { buttonClasses, Card, EmptyState, Table, type TableColumn } from "@/design/ui";
import { useDashboard } from "@/context/DashboardContext";
import useFormat from "@/i18n/useFormat";
import { durationMessage } from "@/utils/Dashboard/format";
import WidgetLink from "./WidgetLink";

/** The scheduled tests, soonest first. */
const UpcomingTests = () => {
  const t = useTranslations("dashboard");
  const format = useFormat();
  const { data, loading } = useDashboard();
  const tests = data?.upcoming_tests ?? [];

  const duration = (minutes: number | null) => {
    const message = durationMessage(minutes);
    return message ? t(`duration.${message.key}`, message.values) : "—";
  };

  const columns: TableColumn<DashboardUpcomingTest>[] = [
    { key: "test", header: t("upcoming.test"), cell: (row) => row.test_name ?? t("untitledTest"), sortValue: (row) => row.test_name },
    { key: "class", header: t("upcoming.class"), cell: (row) => row.class_name ?? "—", sortValue: (row) => row.class_name },
    {
      key: "starts",
      header: t("upcoming.starts"),
      cell: (row) => format.dateTime(row.exam_start_time),
      sortValue: (row) => new Date(row.exam_start_time),
      className: "whitespace-nowrap",
    },
    { key: "duration", header: t("upcoming.duration"), cell: (row) => duration(row.duration_minutes), className: "whitespace-nowrap" },
    {
      key: "students",
      header: t("upcoming.students"),
      cell: (row) => format.number(row.student_count),
      sortValue: (row) => row.student_count,
      align: "right",
    },
  ];

  return (
    <Card title={t("upcoming.title")} actions={<WidgetLink href="/tests" label={t("viewAll")} />} flush className="h-full">
      <div className="p-3 sm:p-4">
        <Table
          caption={t("upcoming.caption")}
          columns={columns}
          rows={tests}
          getRowId={(row) => row.id}
          loading={loading}
          defaultSort={{ key: "starts", direction: "asc" }}
          empty={
            <EmptyState
              title={t("upcoming.empty")}
              description={t("upcoming.emptyDetail")}
              action={
                <NextLink href="/tests/create" className={buttonClasses({ size: "sm" })}>
                  {t("createTest")}
                </NextLink>
              }
            />
          }
        />
      </div>
    </Card>
  );
};

export default UpcomingTests;
