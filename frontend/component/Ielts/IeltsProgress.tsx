"use client";

import { useTranslations } from "next-intl";
import { CartesianGrid, Line, LineChart, ReferenceLine, Tooltip, XAxis, YAxis } from "recharts";
import ChartTooltip from "@/component/Dashboard/ChartTooltip";
import { axisTick, chartColors } from "@/component/Dashboard/chartTheme";
import useApiData from "@/component/Homework/useApiData";
import { Card, EmptyState, ErrorState, PageHeader, Skeleton, Table, type TableColumn } from "@/design/ui";
import useFormat from "@/i18n/useFormat";
import { IELTS_MODULES } from "./bands";

type Mock = IeltsProgressView["mocks"][number];
type QuestionType = IeltsProgressView["question_types"][number];

/**
 * Band progress (P10-07, IEL-09): one small chart per module (bands over time against the dashed
 * target), complete mocks with the overall band, and the weakest question types. Staff open it
 * for a student; a student sees their own.
 */
const IeltsProgress = ({ studentId }: { studentId?: string }) => {
  const t = useTranslations("ieltsProgress");
  const tt = useTranslations("ieltsTests");
  const tb = useTranslations("ieltsBuilder");
  const format = useFormat();
  const { data, failed, reload } = useApiData<IeltsProgressView>(`/ielts/progress/${studentId ?? "me"}`);
  const band = (value: number | null | undefined) => (value === null || value === undefined ? "—" : format.number(value, { minimumFractionDigits: 1 }));

  if (failed !== null) return <ErrorState title={failed === 404 ? t("notFound") : t("loadFailed")} onRetry={reload} />;
  if (!data) {
    return (
      <Card aria-busy="true">
        <Skeleton lines={8} />
      </Card>
    );
  }

  const mockColumns: TableColumn<Mock>[] = [
    { key: "test", header: t("test"), cell: (m) => m.test_title },
    { key: "at", header: t("date"), hideOnMobile: true, cell: (m) => format.date(m.at, { dateStyle: "medium" }), sortValue: (m) => m.at },
    ...IELTS_MODULES.map((m) => ({ key: m, header: tt(`modulesShort.${m}`), align: "right" as const, cell: (row: Mock) => band(row.bands[m]) })),
    { key: "overall", header: t("overall"), align: "right", cell: (m) => <strong>{band(m.overall)}</strong>, sortValue: (m) => m.overall },
  ];
  const typeColumns: TableColumn<QuestionType>[] = [
    { key: "type", header: t("questionType"), cell: (q) => tb(`groupTypes.${q.type}` as "groupTypes.SHORT_ANSWER") },
    { key: "right", header: t("right"), align: "right", cell: (q) => t("rightOf", { right: q.right, total: q.total }) },
    { key: "percent", header: t("percent"), align: "right", cell: (q) => `${format.number(q.percent)}%`, sortValue: (q) => q.percent },
  ];

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader
        title={studentId ? t("titleFor", { name: data.profile.student.full_name }) : t("title")}
        description={data.profile.target_overall === null ? t("noTarget") : t("target", { band: band(data.profile.target_overall) })}
      />
      <div className="grid gap-4 md:grid-cols-2">
        {IELTS_MODULES.map((m) => {
          const points = data.modules[m].map((p, i) => ({ ...p, label: format.number(i + 1) }));
          const target = data.profile.target_bands[m] ?? data.profile.target_overall ?? null;
          return (
            <Card key={m} title={tt(`modulesShort.${m}`)}>
              {points.length === 0 ? (
                <EmptyState className="py-4" title={t("noBands")} />
              ) : (
                <figure className="h-48" aria-label={t("chartLabel", { module: tt(`modulesShort.${m}`), bands: points.map((p) => band(p.band)).join(", ") })}>
                  <LineChart responsive style={{ width: "100%", height: "100%" }} data={points} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
                    <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: chartColors.grid }} />
                    <YAxis domain={[0, 9]} ticks={[0, 3, 5, 7, 9]} tick={axisTick} tickLine={false} axisLine={false} width="auto" tickFormatter={(v: number) => format.number(v)} />
                    {target !== null ? (
                      <ReferenceLine y={target} stroke={chartColors.axis} strokeDasharray="4 4" label={{ value: t("targetShort", { band: band(target) }), position: "insideTopRight", fill: chartColors.axis, fontSize: 12 }} />
                    ) : null}
                    <Tooltip
                      content={({ active, payload }) => {
                        const p = active ? (payload?.[0]?.payload as (IeltsBandPoint & { label: string }) | undefined) : undefined;
                        return p ? <ChartTooltip title={t("bandShort", { band: band(p.band) })} detail={`${p.test_title} · ${format.date(p.at, { dateStyle: "medium" })}`} /> : null;
                      }}
                    />
                    <Line dataKey="band" stroke={chartColors.primary} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} isAnimationActive={false} />
                  </LineChart>
                </figure>
              )}
            </Card>
          );
        })}
      </div>
      <Card title={t("mocksTitle")} description={t("mocksDescription")}>
        <Table caption={t("mocksTitle")} columns={mockColumns} rows={data.mocks} getRowId={(m) => m.assignment_id} empty={<EmptyState className="py-4" title={t("noMocks")} />} />
      </Card>
      <Card title={t("typesTitle")} description={t("typesDescription")}>
        <Table caption={t("typesTitle")} columns={typeColumns} rows={data.question_types} getRowId={(q) => q.type} empty={<EmptyState className="py-4" title={t("noTypes")} />} />
      </Card>
    </div>
  );
};

export default IeltsProgress;
