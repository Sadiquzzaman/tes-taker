"use client";

import NextLink from "next/link";
import { useTranslations } from "next-intl";
import { buttonClasses, Card, EmptyState, Skeleton } from "@/design/ui";
import { useDashboard } from "@/context/DashboardContext";
import useFormat from "@/i18n/useFormat";
import WidgetLink from "./WidgetLink";

/** How many students the teacher has: total, active and still pending. */
const TotalStudents = () => {
  const t = useTranslations("dashboard");
  const format = useFormat();
  const { data, loading } = useDashboard();
  const summary = data?.students_summary;
  const total = summary?.total ?? 0;

  const figures = [
    { key: "total", label: t("students.total"), value: total },
    { key: "active", label: t("students.active"), value: summary?.active ?? 0 },
    { key: "pending", label: t("students.pending"), value: summary?.pending ?? 0 },
  ];

  return (
    <Card title={t("students.title")} actions={<WidgetLink href="/classes" label={t("students.add")} />} className="h-full">
      {loading ? (
        <Skeleton lines={3} />
      ) : total === 0 ? (
        <EmptyState
          className="py-4"
          title={t("students.empty")}
          description={t("students.emptyDetail")}
          action={
            <NextLink href="/classes" className={buttonClasses({ size: "sm" })}>
              {t("students.add")}
            </NextLink>
          }
        />
      ) : (
        <dl className="grid grid-cols-3 gap-3">
          {figures.map((figure) => (
            <div key={figure.key} className="flex flex-col gap-1 rounded-input bg-canvas p-3">
              <dt className="text-caption text-ink-muted">{figure.label}</dt>
              <dd className="text-title-sm font-semibold text-ink">{format.number(figure.value)}</dd>
            </div>
          ))}
        </dl>
      )}
    </Card>
  );
};

export default TotalStudents;
