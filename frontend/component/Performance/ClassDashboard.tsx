"use client";

import { useTranslations } from "next-intl";
import NextLink from "next/link";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";
import ChartTooltip from "@/component/Dashboard/ChartTooltip";
import { axisTick, chartColors } from "@/component/Dashboard/chartTheme";
import useApiData from "@/component/Homework/useApiData";
import { Button, Card, EmptyState, ErrorState, PageHeader, Select, Skeleton, StatTile, StatusPill, Table, Tabs, type TableColumn } from "@/design/ui";
import { cn, focusRing } from "@/design/ui/cn";
import useWorkspace from "@/hooks/organization/useWorkspace";
import useFormat from "@/i18n/useFormat";

/** The line a row shows: overall, or one subject's. */
const lineOf = (row: StudentScoreRow, subjectId: string) => (subjectId ? row.subjects.find((s) => s.subject.id === subjectId) : row.overall) ?? null;

/**
 * The class dashboard (PRF-07): for a section and a term (or the session), optionally one
 * subject, the average, highest and lowest score, how many got each grade, the class average in
 * each exam, homework and attendance rates, the students at risk, and every student's score with
 * their position; a name opens the student's page. Owners, admins and staff also see the whole
 * school (PRF-08): every section and subject side by side.
 */
const ClassDashboard = () => {
  const t = useTranslations("performance");
  const format = useFormat();
  const [sessionId, setSessionId] = useState("");
  const { data: visible, failed: visibleFailed, reload: reloadVisible } = useApiData<VisibleScoreSections>("/scores/sections", { session_id: sessionId || undefined });
  const { data: sessions } = useApiData<AcademicSession[]>("/sessions");
  const [chosenSection, setChosenSection] = useState("");
  const [termId, setTermId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const { memberRole } = useWorkspace();
  const manager = memberRole === "OWNER" || memberRole === "ADMIN" || memberRole === "ASSISTANT";
  const [view, setView] = useState<"school" | "section">("school");
  const showSchool = manager && view === "school";
  const sectionId = visible?.sections.some((s) => s.id === chosenSection) ? chosenSection : (visible?.sections[0]?.id ?? "");
  const validTerm = visible?.terms.some((term) => term.id === termId) ? termId : "";

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader title={t("title")} description={t("intro")} />
      {visibleFailed !== null ? (
        <ErrorState title={t("loadFailed")} onRetry={reloadVisible} />
      ) : !visible ? (
        <Card aria-busy="true">
          <Skeleton lines={4} />
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            {sessions && sessions.length > 1 ? (
              <Select
                label={t("session")}
                fieldClassName="sm:w-44"
                placeholder={false}
                value={sessionId || visible.session.id}
                onChange={(event) => setSessionId(event.target.value)}
                options={sessions.map((session) => ({ value: session.id, label: session.name }))}
              />
            ) : null}
            {visible.sections.length && !showSchool ? (
              <Select
                label={t("section")}
                fieldClassName="sm:w-56"
                placeholder={false}
                value={sectionId}
                onChange={(event) => {
                  setChosenSection(event.target.value);
                  setSubjectId("");
                }}
                options={visible.sections.map((section) => ({ value: section.id, label: `${section.class_name} ${section.name}`.trim() }))}
              />
            ) : null}
            {visible.terms.length ? (
              <Select
                label={t("term")}
                fieldClassName="sm:w-48"
                placeholder={t("wholeSession")}
                value={validTerm}
                onChange={(event) => setTermId(event.target.value)}
                options={visible.terms.map((term) => ({ value: term.id, label: term.name }))}
              />
            ) : null}
          </div>
          {manager ? (
            <Tabs
              selectedKey={view}
              onChange={(key) => setView(key as "school" | "section")}
              tabs={[
                {
                  key: "school",
                  label: t("wholeSchool"),
                  content: (
                    <SchoolView
                      key={`${visible.session.id}:${validTerm}`}
                      sessionId={visible.session.id}
                      termId={validTerm}
                      format={format}
                      onOpen={(id) => {
                        setChosenSection(id);
                        setSubjectId("");
                        setView("section");
                      }}
                    />
                  ),
                },
                { key: "section", label: t("oneSection"), content: null },
              ]}
            />
          ) : null}
          {showSchool ? null : sectionId ? (
            <SectionView key={`${sectionId}:${validTerm}`} sectionId={sectionId} termId={validTerm} subjectId={subjectId} onSubject={setSubjectId} format={format} />
          ) : (
            <Card>
              <EmptyState title={t("noSections")} description={t("noSectionsHint")} />
            </Card>
          )}
        </>
      )}
    </div>
  );
};

/** The whole school (PRF-08): each section's numbers and each subject's average across sections. */
const SchoolView = ({ sessionId, termId, format, onOpen }: { sessionId: string; termId: string; format: ReturnType<typeof useFormat>; onOpen: (sectionId: string) => void }) => {
  const t = useTranslations("performance");
  const { data, failed, reload } = useApiData<SchoolOverview>("/scores/overview", { session_id: sessionId, term_id: termId || undefined });
  const pct = (value: number | null) => (value === null ? "—" : `${format.number(value)}%`);
  if (failed !== null) return <ErrorState title={t("loadFailed")} onRetry={reload} />;
  if (!data) {
    return (
      <Card aria-busy="true">
        <Skeleton lines={6} />
      </Card>
    );
  }
  type Row = SchoolOverview["sections"][number];
  const label = (row: Row) => `${row.section.class_name} ${row.section.name}`.trim();
  const sectionColumns: TableColumn<Row>[] = [
    { key: "section", header: t("section"), cell: (row) => label(row), sortValue: (row) => label(row) },
    { key: "students", header: t("columns.students"), align: "right", cell: (row) => format.number(row.students), hideOnMobile: true },
    { key: "average", header: t("average"), align: "right", cell: (row) => pct(row.average_pct), sortValue: (row) => row.average_pct ?? -1 },
    { key: "highest", header: t("highest"), align: "right", cell: (row) => pct(row.highest_pct), hideOnMobile: true },
    { key: "lowest", header: t("lowest"), align: "right", cell: (row) => pct(row.lowest_pct), hideOnMobile: true },
    { key: "attendance", header: t("attendanceRate"), align: "right", cell: (row) => pct(row.attendance_pct), sortValue: (row) => row.attendance_pct ?? -1, hideOnMobile: true },
    { key: "homework", header: t("homeworkRate"), align: "right", cell: (row) => pct(row.homework_rate_pct), hideOnMobile: true },
    { key: "risk", header: t("atRiskTitle"), align: "right", cell: (row) => format.number(row.at_risk), sortValue: (row) => row.at_risk },
    {
      key: "open",
      header: t("columns.open"),
      cell: (row) => (
        <Button size="sm" variant="ghost" onClick={() => onOpen(row.section.id)} aria-label={t("openSection", { section: label(row) })}>
          {t("open")}
        </Button>
      ),
    },
  ];
  const subjectColumns: TableColumn<SchoolOverview["subjects"][number]>[] = [
    { key: "subject", header: t("columns.subject"), cell: (row) => row.subject.name, sortValue: (row) => row.subject.name },
    { key: "average", header: t("average"), align: "right", cell: (row) => pct(row.average_pct), sortValue: (row) => row.average_pct ?? -1 },
    { key: "sections", header: t("columns.sections"), align: "right", cell: (row) => format.number(row.sections) },
  ];
  return (
    <div className="flex flex-col gap-4 pt-4">
      <Card flush title={t("bySection")}>
        <Table
          caption={t("bySection")}
          columns={sectionColumns}
          rows={data.sections}
          getRowId={(row) => row.section.id}
          defaultSort={{ key: "section", direction: "asc" }}
          empty={<EmptyState title={t("noSections")} />}
        />
      </Card>
      <Card flush title={t("bySubject")}>
        <Table caption={t("bySubject")} columns={subjectColumns} rows={data.subjects} getRowId={(row) => row.subject.id} defaultSort={{ key: "subject", direction: "asc" }} empty={<EmptyState title={t("noScores")} />} />
      </Card>
    </div>
  );
};

const SectionView = ({
  sectionId,
  termId,
  subjectId,
  onSubject,
  format,
}: {
  sectionId: string;
  termId: string;
  subjectId: string;
  onSubject: (id: string) => void;
  format: ReturnType<typeof useFormat>;
}) => {
  const t = useTranslations("performance");
  const { data, failed, reload } = useApiData<SectionScores>(`/scores/sections/${sectionId}`, { term_id: termId || undefined });
  const pct = (value: number | null | undefined) => (value === null || value === undefined ? "—" : `${format.number(value)}%`);

  const summary = useMemo(() => {
    if (!data) return null;
    const scores = data.students.map((row) => lineOf(row, subjectId)?.score_pct).filter((v): v is number => v !== null && v !== undefined);
    const grades = new Map<string, number>();
    for (const row of data.students) {
      const grade = lineOf(row, subjectId)?.grade?.grade;
      if (grade) grades.set(grade, (grades.get(grade) ?? 0) + 1);
    }
    const set = data.students.reduce((sum, row) => sum + row.homework.set, 0);
    const missing = data.students.reduce((sum, row) => sum + row.homework.missing, 0);
    const attendance = data.students.map((row) => row.overall.attendance_pct).filter((v): v is number => v !== null);
    const round = (value: number) => Math.round(value * 10) / 10;
    return {
      average: scores.length ? round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
      highest: scores.length ? Math.max(...scores) : null,
      lowest: scores.length ? Math.min(...scores) : null,
      grades: [...grades].map(([grade, count]) => ({ grade, count })).sort((a, b) => a.grade.localeCompare(b.grade)),
      homeworkRate: set ? round(((set - missing) / set) * 100) : null,
      attendanceRate: attendance.length ? round(attendance.reduce((a, b) => a + b, 0) / attendance.length) : null,
    };
  }, [data, subjectId]);

  if (failed !== null) return <ErrorState title={t("loadFailed")} onRetry={reload} />;
  if (!data || !summary) {
    return (
      <Card aria-busy="true">
        <Skeleton lines={8} />
      </Card>
    );
  }

  const exams = data.exams.filter((exam) => !subjectId || exam.subject_id === subjectId).map((exam) => ({ ...exam, label: exam.name.length > 14 ? `${exam.name.slice(0, 14)}…` : exam.name }));
  const atRisk = data.students.filter((row) => row.at_risk.length > 0);
  const columns: TableColumn<StudentScoreRow>[] = [
    { key: "position", header: t("columns.position"), align: "right", cell: (row) => (row.position ? format.number(row.position) : "—"), sortValue: (row) => row.position ?? Number.MAX_SAFE_INTEGER },
    {
      key: "name",
      header: t("columns.student"),
      cell: (row) => (
        <NextLink href={`/performance/students/${row.student.id}?section_id=${data.section.id}`} className={cn("font-medium text-primary underline-offset-2 hover:underline", focusRing)}>
          {row.student.roll_no ? `${row.student.roll_no}. ` : ""}
          {row.student.full_name}
        </NextLink>
      ),
      sortValue: (row) => row.student.full_name,
    },
    { key: "score", header: t("columns.score"), align: "right", cell: (row) => pct(lineOf(row, subjectId)?.score_pct), sortValue: (row) => lineOf(row, subjectId)?.score_pct ?? -1 },
    { key: "grade", header: t("columns.grade"), cell: (row) => lineOf(row, subjectId)?.grade?.grade ?? "—" },
    { key: "exams", header: t("parts.exams"), align: "right", cell: (row) => pct(lineOf(row, subjectId)?.exams_pct), hideOnMobile: true },
    { key: "homework", header: t("parts.homework"), align: "right", cell: (row) => pct(lineOf(row, subjectId)?.homework_pct), hideOnMobile: true },
    { key: "attendance", header: t("parts.attendance"), align: "right", cell: (row) => pct(row.overall.attendance_pct), hideOnMobile: true },
    { key: "behaviour", header: t("parts.behaviour"), align: "right", cell: (row) => pct(lineOf(row, subjectId)?.behaviour_pct), hideOnMobile: true },
  ];

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-body-sm text-ink-muted">
          {t("weightsLine", {
            exams: format.number(data.weights.exams_pct),
            homework: format.number(data.weights.homework_pct),
            attendance: format.number(data.weights.attendance_pct),
            behaviour: format.number(data.weights.behaviour_pct),
          })}
        </p>
        {data.subjects.length ? (
          <Select
            label={t("subject")}
            fieldClassName="sm:w-48"
            placeholder={t("allSubjects")}
            value={subjectId}
            onChange={(event) => onSubject(event.target.value)}
            options={data.subjects.map((subject) => ({ value: subject.id, label: subject.name }))}
          />
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label={t("average")} value={pct(summary.average)} />
        <StatTile label={t("highest")} value={pct(summary.highest)} />
        <StatTile label={t("lowest")} value={pct(summary.lowest)} />
        <StatTile label={t("homeworkRate")} value={pct(summary.homeworkRate)} />
        <StatTile label={t("attendanceRate")} value={pct(summary.attendanceRate)} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={t("gradesTitle")}>
          {summary.grades.length === 0 ? (
            <EmptyState className="py-4" title={t("noScores")} />
          ) : (
            <figure className="h-52" aria-label={t("gradesChart", { grades: summary.grades.map((g) => `${g.grade} ${format.number(g.count)}`).join(", ") })}>
              <BarChart responsive style={{ width: "100%", height: "100%" }} data={summary.grades} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
                <XAxis dataKey="grade" tick={axisTick} tickLine={false} axisLine={{ stroke: chartColors.grid }} />
                <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} width="auto" tickFormatter={(value: number) => format.number(value)} />
                <Tooltip
                  cursor={{ fill: "var(--color-primary-soft)" }}
                  content={({ active, payload }) => {
                    const point = active ? (payload?.[0]?.payload as { grade: string; count: number } | undefined) : undefined;
                    return point ? <ChartTooltip title={t("studentsCount", { count: point.count })} detail={point.grade} /> : null;
                  }}
                />
                <Bar dataKey="count" fill={chartColors.primary} radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </figure>
          )}
        </Card>
        <Card title={t("trendTitle")}>
          {exams.length === 0 ? (
            <EmptyState className="py-4" title={t("noExams")} />
          ) : (
            <figure className="h-52" aria-label={t("trendChart", { exams: exams.map((e) => `${e.name} ${pct(e.average_pct)}`).join(", ") })}>
              <LineChart responsive style={{ width: "100%", height: "100%" }} data={exams} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
                <XAxis dataKey="label" interval={0} tick={axisTick} tickLine={false} axisLine={{ stroke: chartColors.grid }} />
                <YAxis domain={[0, 100]} tick={axisTick} tickLine={false} axisLine={false} width="auto" tickFormatter={(value: number) => format.number(value)} />
                <Tooltip
                  content={({ active, payload }) => {
                    const point = active ? (payload?.[0]?.payload as ScoreExamSummary | undefined) : undefined;
                    return point ? <ChartTooltip title={pct(point.average_pct)} detail={point.name} /> : null;
                  }}
                />
                <Line dataKey="average_pct" stroke={chartColors.primary} strokeWidth={2} dot={{ r: 3 }} connectNulls />
              </LineChart>
            </figure>
          )}
        </Card>
      </div>
      <Card title={t("atRiskTitle")} description={t("atRiskLimits", { score: format.number(data.thresholds.score_pct), attendance: format.number(data.thresholds.attendance_pct), missing: format.number(data.thresholds.missing_homework) })}>
        {atRisk.length === 0 ? (
          <p className="text-body-sm text-ink-muted">{t("noneAtRisk")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {atRisk.map((row) => (
              <li key={row.student.id} className="flex flex-wrap items-center gap-2">
                <NextLink href={`/performance/students/${row.student.id}?section_id=${data.section.id}`} className={cn("font-medium text-primary underline-offset-2 hover:underline", focusRing)}>
                  {row.student.full_name}
                </NextLink>
                {row.at_risk.map((reason) => (
                  <StatusPill key={reason} tone="warning">
                    {t(`risk.${reason}`, { score: pct(row.overall.score_pct), attendance: pct(row.overall.attendance_pct), missing: format.number(row.missing_homework) })}
                  </StatusPill>
                ))}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card flush>
        <Table
          caption={t("tableCaption", { section: `${data.section.class_name} ${data.section.name}`.trim() })}
          columns={columns}
          rows={data.students}
          getRowId={(row) => row.student.id}
          defaultSort={{ key: "position", direction: "asc" }}
          empty={<EmptyState title={t("noStudents")} />}
        />
      </Card>
    </>
  );
};

export default ClassDashboard;
