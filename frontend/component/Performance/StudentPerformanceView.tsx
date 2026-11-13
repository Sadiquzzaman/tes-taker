"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";
import ChartTooltip from "@/component/Dashboard/ChartTooltip";
import { axisTick, chartColors } from "@/component/Dashboard/chartTheme";
import useApiData from "@/component/Homework/useApiData";
import { Card, EmptyState, ErrorState, PageHeader, Select, Skeleton, StatTile, StatusPill, Table, type TableColumn } from "@/design/ui";
import useFormat from "@/i18n/useFormat";

/**
 * One student's performance (PRF-05, PRF-06): the overall score and grade, each subject with its
 * parts, the trend per term, attendance, homework on time and behaviour, every exam and homework
 * with its mark, and the strongest and weakest subjects; an earlier session's section shows its
 * history. Staff see live results; a student sees their own published results, and their position
 * only when the school shows it.
 */
const StudentPerformanceView = ({ studentId, initialSectionId, own = false }: { studentId: string; initialSectionId?: string; own?: boolean }) => {
  const t = useTranslations("performance");
  const format = useFormat();
  const [sectionId, setSectionId] = useState(initialSectionId ?? "");
  const [termId, setTermId] = useState("");
  const { data, failed, reload } = useApiData<StudentPerformance>(`/scores/students/${studentId}`, { section_id: sectionId || undefined, term_id: termId || undefined });
  const pct = (value: number | null | undefined) => (value === null || value === undefined ? "—" : `${format.number(value)}%`);
  const day = (date: string) => format.date(`${date}T00:00:00Z`, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

  if (failed !== null) return <ErrorState title={t("loadFailed")} onRetry={reload} />;
  if (!data) {
    return (
      <Card aria-busy="true">
        <Skeleton lines={8} />
      </Card>
    );
  }

  const subjectColumns: TableColumn<SubjectScoreLine>[] = [
    { key: "subject", header: t("columns.subject"), cell: (row) => row.subject.name, sortValue: (row) => row.subject.name },
    { key: "score", header: t("columns.score"), align: "right", cell: (row) => pct(row.score_pct), sortValue: (row) => row.score_pct ?? -1 },
    { key: "grade", header: t("columns.grade"), cell: (row) => (row.grade ? `${row.grade.grade} (${format.number(row.grade.gpa)})` : "—") },
    { key: "exams", header: t("parts.exams"), align: "right", cell: (row) => pct(row.exams_pct), hideOnMobile: true },
    { key: "homework", header: t("parts.homework"), align: "right", cell: (row) => pct(row.homework_pct), hideOnMobile: true },
    { key: "behaviour", header: t("parts.behaviour"), align: "right", cell: (row) => pct(row.behaviour_pct), hideOnMobile: true },
  ];
  const examColumns: TableColumn<StudentPerformance["exams"][number]>[] = [
    { key: "name", header: t("columns.exam"), cell: (row) => row.name, sortValue: (row) => row.name },
    { key: "subject", header: t("columns.subject"), cell: (row) => row.subject?.name ?? "—", hideOnMobile: true },
    { key: "date", header: t("columns.date"), cell: (row) => day(row.date), sortValue: (row) => row.date },
    { key: "kind", header: t("columns.kind"), cell: (row) => t(`kinds.${row.kind}`), hideOnMobile: true },
    {
      key: "marks",
      header: t("columns.marks"),
      align: "right",
      cell: (row) => (row.is_absent ? <StatusPill tone="neutral">{t("absent")}</StatusPill> : `${format.number(row.marks ?? 0)}/${format.number(row.total)} · ${pct(row.percent)}`),
      sortValue: (row) => row.percent ?? -1,
    },
  ];
  const homeworkColumns: TableColumn<StudentPerformance["homework_items"][number]>[] = [
    { key: "title", header: t("columns.homework"), cell: (row) => row.title, sortValue: (row) => row.title },
    { key: "subject", header: t("columns.subject"), cell: (row) => row.subject?.name ?? "—", hideOnMobile: true },
    { key: "due", header: t("columns.due"), cell: (row) => day(row.due_date), sortValue: (row) => row.due_date },
    {
      key: "score",
      header: t("columns.score"),
      align: "right",
      cell: (row) =>
        row.is_missing ? (
          <StatusPill tone="danger">{t("missing")}</StatusPill>
        ) : (
          <span className="inline-flex items-center gap-2">
            {row.is_late ? <StatusPill tone="warning">{t("late")}</StatusPill> : null}
            {pct(row.percent)}
          </span>
        ),
      sortValue: (row) => row.percent,
    },
  ];
  const sectionLabel = (s: { name: string; class_name: string }) => `${s.class_name} ${s.name}`.trim();
  const trend = data.trend.filter((point) => point.score_pct !== null);

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader
        title={own ? t("myTitle") : data.student.full_name}
        description={[own ? null : data.student.roll_no ? t("roll", { roll: data.student.roll_no }) : null, sectionLabel(data.section), data.section.session.name, data.period.term?.name ?? t("wholeSession")]
          .filter(Boolean)
          .join(" · ")}
      />
      <div className="flex flex-wrap items-end gap-3">
        {data.sections.length > 1 ? (
          <Select
            label={t("sessionHistory")}
            fieldClassName="sm:w-64"
            placeholder={false}
            value={data.section.id}
            onChange={(event) => {
              setSectionId(event.target.value);
              setTermId("");
            }}
            options={data.sections.map((s) => ({ value: s.id, label: `${s.session.name} · ${sectionLabel(s)}` }))}
          />
        ) : null}
        {data.terms.length ? (
          <Select
            label={t("term")}
            fieldClassName="sm:w-48"
            placeholder={t("wholeSession")}
            value={data.period.term?.id ?? ""}
            onChange={(event) => setTermId(event.target.value)}
            options={data.terms.map((term) => ({ value: term.id, label: term.name }))}
          />
        ) : null}
      </div>
      {data.published_only ? <p className="text-body-sm text-ink-muted">{t("publishedOnly")}</p> : null}
      {data.at_risk.length ? (
        <div className="flex flex-wrap gap-2" aria-label={t("atRiskTitle")}>
          {data.at_risk.map((reason) => (
            <StatusPill key={reason} tone="warning">
              {t(`risk.${reason}`, { score: pct(data.overall.score_pct), attendance: pct(data.attendance.attendance_pct), missing: format.number(data.homework.missing) })}
            </StatusPill>
          ))}
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label={t("overall")} value={data.overall.score_pct === null ? "—" : `${pct(data.overall.score_pct)}${data.overall.grade ? ` · ${data.overall.grade.grade}` : ""}`} />
        <StatTile label={t("gpa")} value={data.overall.grade ? format.number(data.overall.grade.gpa) : "—"} />
        <StatTile label={t("position")} value={data.position ? t("positionOf", { position: format.number(data.position), size: format.number(data.class_size) }) : "—"} />
        <StatTile label={t("parts.attendance")} value={pct(data.attendance.attendance_pct)} />
        <StatTile label={t("onTime")} value={pct(data.homework.on_time_pct)} />
        <StatTile label={t("parts.behaviour")} value={pct(data.overall.behaviour_pct)} />
      </div>
      <Card flush>
        <Table
          caption={t("subjectsCaption")}
          columns={subjectColumns}
          rows={data.subjects}
          getRowId={(row) => row.subject.id}
          defaultSort={{ key: "subject", direction: "asc" }}
          empty={<EmptyState title={t("noSubjects")} />}
        />
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={t("strengthsTitle")} description={t("strengthsHint")}>
          {data.strengths.length === 0 ? (
            <p className="text-body-sm text-ink-muted">{t("notEnough")}</p>
          ) : (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-body-sm">
              <dt className="font-medium text-ink">{t("strongest")}</dt>
              <dd className="text-ink">{data.strengths.map((s) => `${s.subject.name} ${pct(s.score_pct)}`).join(", ")}</dd>
              <dt className="font-medium text-ink">{t("weakest")}</dt>
              <dd className="text-ink">{data.weaknesses.length ? data.weaknesses.map((s) => `${s.subject.name} ${pct(s.score_pct)}`).join(", ") : "—"}</dd>
            </dl>
          )}
        </Card>
        <Card title={t("termTrendTitle")}>
          {trend.length < 2 ? (
            <p className="text-body-sm text-ink-muted">{trend.length ? t("trendOne", { term: trend[0].term.name, score: pct(trend[0].score_pct) }) : t("trendNone")}</p>
          ) : (
            <figure className="h-44" aria-label={t("termTrendChart", { terms: trend.map((p) => `${p.term.name} ${pct(p.score_pct)}`).join(", ") })}>
              <LineChart responsive style={{ width: "100%", height: "100%" }} data={trend.map((p) => ({ name: p.term.name, score: p.score_pct }))} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
                <XAxis dataKey="name" tick={axisTick} tickLine={false} axisLine={{ stroke: chartColors.grid }} />
                <YAxis domain={[0, 100]} tick={axisTick} tickLine={false} axisLine={false} width="auto" tickFormatter={(value: number) => format.number(value)} />
                <Tooltip
                  content={({ active, payload }) => {
                    const point = active ? (payload?.[0]?.payload as { name: string; score: number } | undefined) : undefined;
                    return point ? <ChartTooltip title={pct(point.score)} detail={point.name} /> : null;
                  }}
                />
                <Line dataKey="score" stroke={chartColors.primary} strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </figure>
          )}
        </Card>
      </div>
      <Card title={t("examsTitle")} flush>
        <Table caption={t("examsTitle")} columns={examColumns} rows={data.exams} getRowId={(row) => `${row.kind}:${row.id}`} defaultSort={{ key: "date", direction: "desc" }} empty={<EmptyState title={t("noExams")} />} />
      </Card>
      <Card title={t("homeworkTitle")} flush>
        <Table
          caption={t("homeworkTitle")}
          columns={homeworkColumns}
          rows={data.homework_items}
          getRowId={(row) => row.id}
          defaultSort={{ key: "due", direction: "desc" }}
          empty={<EmptyState title={t("noHomework")} />}
        />
      </Card>
    </div>
  );
};

export default StudentPerformanceView;
