"use client";

import NextLink from "next/link";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import { buttonClasses, Card, EmptyState, Skeleton } from "@/design/ui";
import { useDashboard } from "@/context/DashboardContext";
import useFormat from "@/i18n/useFormat";
import ChartTooltip from "./ChartTooltip";
import { axisTick, chartColors } from "./chartTheme";
import WidgetLink from "./WidgetLink";

type ClassPoint = { name: string; fullName: string; students: number };

/** Students in each class, as bars. */
const MyClasses = () => {
  const t = useTranslations("dashboard");
  const format = useFormat();
  const { data, loading } = useDashboard();

  const points = useMemo<ClassPoint[]>(
    () =>
      (data?.classes_summary ?? []).map((cls) => ({
        name: cls.name.length > 12 ? `${cls.name.slice(0, 12)}…` : cls.name,
        fullName: cls.name,
        students: cls.student_count,
      })),
    [data?.classes_summary],
  );

  return (
    <Card title={t("classes.title")} actions={<WidgetLink href="/classes" label={t("viewAll")} />} className="h-full">
      {loading ? (
        <Skeleton className="h-52" />
      ) : points.length === 0 ? (
        <EmptyState
          className="py-4"
          title={t("classes.empty")}
          description={t("classes.emptyDetail")}
          action={
            <NextLink href="/classes/create" className={buttonClasses({ size: "sm" })}>
              {t("createClass")}
            </NextLink>
          }
        />
      ) : (
        <figure className="h-52" aria-label={t("classes.chartLabel")}>
          <BarChart responsive style={{ width: "100%", height: "100%" }} data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
            <XAxis dataKey="name" interval={0} tick={axisTick} tickLine={false} axisLine={{ stroke: chartColors.grid }} />
            <YAxis
              allowDecimals={false}
              tick={axisTick}
              tickLine={false}
              axisLine={false}
              width="auto"
              tickFormatter={(value: number) => format.number(value)}
            />
            <Tooltip
              cursor={{ fill: "var(--color-primary-soft)" }}
              content={({ active, payload }) => {
                const point = active ? (payload?.[0]?.payload as ClassPoint | undefined) : undefined;
                return point ? <ChartTooltip title={t("classes.tooltip", { count: point.students })} detail={point.fullName} /> : null;
              }}
            />
            <Bar dataKey="students" name={t("classes.series")} fill={chartColors.primary} radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </figure>
      )}
    </Card>
  );
};

export default MyClasses;
