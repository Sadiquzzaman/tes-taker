"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";
import { Card, Select, Skeleton } from "@/design/ui";
import { useDashboard } from "@/context/DashboardContext";
import useFormat from "@/i18n/useFormat";
import ChartTooltip from "./ChartTooltip";
import { axisTick, chartColors } from "./chartTheme";

const PERIODS: DashboardActivityPeriod[] = ["monthly", "weekly", "daily"];

type ActivityPoint = { name: string; exams: number; participants: number };

/** Exams over time (by month, week or day), with participants in the tooltip. */
const MyActivity = () => {
  const t = useTranslations("dashboard.activity");
  const format = useFormat();
  const { data, loading, activityPeriod, setActivityPeriod } = useDashboard();

  const points = useMemo<ActivityPoint[]>(
    () =>
      (data?.activity.data ?? []).map((point) => ({
        name: point.label,
        exams: point.exam_count,
        participants: point.participant_count,
      })),
    [data?.activity.data],
  );
  const hasActivity = points.some((point) => point.exams > 0 || point.participants > 0);

  return (
    <Card
      title={t("title")}
      className="h-full"
      actions={
        <Select
          label={t("period")}
          hideLabel
          placeholder={false}
          value={activityPeriod}
          onChange={(event) => setActivityPeriod(event.target.value as DashboardActivityPeriod)}
          options={PERIODS.map((period) => ({ value: period, label: t(period) }))}
          className="h-8 text-body-sm"
          fieldClassName="w-32"
        />
      }
    >
      {loading ? (
        <Skeleton className="h-48" />
      ) : !hasActivity ? (
        <p className="flex h-48 items-center justify-center rounded-input border border-dashed border-border px-4 text-center text-body-sm text-ink-muted">
          {t("empty")}
        </p>
      ) : (
        <figure className="h-48" aria-label={t("chartLabel")}>
          <LineChart responsive style={{ width: "100%", height: "100%" }} data={points} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <XAxis dataKey="name" tick={axisTick} tickLine={false} axisLine={{ stroke: chartColors.grid }} />
            <YAxis
              allowDecimals={false}
              tick={axisTick}
              tickLine={false}
              axisLine={false}
              width="auto"
              tickFormatter={(value: number) => format.number(value)}
            />
            <Tooltip
              cursor={{ stroke: chartColors.primary, strokeWidth: 1, strokeDasharray: "4 4" }}
              content={({ active, payload }) => {
                const point = active ? (payload?.[0]?.payload as ActivityPoint | undefined) : undefined;
                return point ? (
                  <ChartTooltip
                    title={t("tooltipExams", { count: point.exams })}
                    detail={t("tooltipParticipants", { count: point.participants })}
                  />
                ) : null;
              }}
            />
            <Line type="monotone" dataKey="exams" name={t("exams")} stroke={chartColors.primary} strokeWidth={2} dot={false} />
          </LineChart>
        </figure>
      )}
    </Card>
  );
};

export default MyActivity;
