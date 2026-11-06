"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button, Card, ChevronLeftIcon, ChevronRightIcon, EmptyState, ErrorState, IconButton, Select, Skeleton, Table, type TableColumn } from "@/design/ui";
import useFormat from "@/i18n/useFormat";
import { downloadCsv, registerCsv, registerFileName } from "@/utils/attendance/paperRegister";
import { shiftMonth } from "@/utils/attendance/status";
import PrintSheet from "./PrintSheet";
import { DayCell, ReportLegend } from "./ReportMarks";
import useReport from "./useReport";

type StudentRow = MonthlyAttendanceReport["students"][number];
const COUNTS = ["present", "late", "absent", "leave"] as const;

/**
 * The monthly register (ATT-13): a student × class-day grid in the calendar colours with letters,
 * each student's counts and attendance %, a print view (A4 landscape, "Print / Save as PDF") and
 * the register CSV (P3-05's format, with a byte-order mark so Excel keeps Bangla).
 */
const MonthlyReport = ({ sections, organization }: { sections: PaperRegisterSection[]; organization: string | null }) => {
  const t = useTranslations("reports");
  const format = useFormat();
  const locale = useLocale();
  const [sectionId, setSectionId] = useState(sections[0]?.id ?? "");
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const { report, failed, retry } = useReport<MonthlyAttendanceReport>(sectionId ? `/attendance/reports/sections/${sectionId}/month` : null, { month });

  const section = sections.find((item) => item.id === sectionId);
  const sectionName = section ? `${section.class_name} ${section.name}` : "";
  const monthName = format.date(`${month}-01T00:00:00Z`, { month: "long", year: "numeric", timeZone: "UTC" });
  const dayOf = (date: string) => format.number(Number(date.slice(8, 10)));
  const pct = (value: number | null) => (value === null ? "—" : `${format.number(value)}%`);

  const columns: TableColumn<StudentRow>[] = report
    ? [
        { key: "roll", header: t("columns.roll"), cell: (row) => row.roll_no ?? "—", sortValue: (row) => Number(row.roll_no) || row.roll_no || "" },
        { key: "name", header: t("columns.name"), cell: (row) => <span className="whitespace-nowrap font-medium text-ink">{row.full_name}</span>, sortValue: (row) => row.full_name },
        ...report.days.map(
          (day, index): TableColumn<StudentRow> => ({
            key: `d${day.date}`,
            header: dayOf(day.date),
            align: "center",
            cell: (row) => <DayCell day={row.days[index]} />,
          }),
        ),
        ...COUNTS.map(
          (key): TableColumn<StudentRow> => ({
            key,
            header: t(`columns.${key}`),
            align: "right",
            cell: (row) => format.number(row.counts[key]),
            sortValue: (row) => row.counts[key],
          }),
        ),
        { key: "pct", header: t("columns.pct"), align: "right", cell: (row) => pct(row.attendance_pct), sortValue: (row) => row.attendance_pct ?? -1 },
      ]
    : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <Select
          label={t("section")}
          fieldClassName="sm:w-72"
          placeholder={false}
          value={sectionId}
          onChange={(event) => setSectionId(event.target.value)}
          options={sections.map((item) => ({ value: item.id, label: `${item.class_name} ${item.name}` }))}
        />
        <div className="flex items-center gap-2">
          <IconButton label={t("previousMonth")} icon={<ChevronLeftIcon />} variant="secondary" size="sm" onClick={() => setMonth(shiftMonth(month, -1))} />
          <span className="min-w-28 text-center text-body-sm font-medium text-ink" aria-live="polite">
            {monthName}
          </span>
          <IconButton label={t("nextMonth")} icon={<ChevronRightIcon />} variant="secondary" size="sm" onClick={() => setMonth(shiftMonth(month, 1))} />
        </div>
      </div>

      <Card
        title={sectionName}
        description={
          report
            ? t("monthHint", { days: report.days.length, classes: report.classes.length, students: report.students.length, pct: pct(report.attendance_pct) })
            : undefined
        }
        actions={
          report ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => window.print()} disabled={report.days.length === 0}>
                {t("print")}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={report.classes.length === 0}
                onClick={() => downloadCsv(registerFileName(report, "register"), registerCsv(report, locale === "bn" ? "bn" : "en", { withMarks: true }))}
              >
                {t("exportCsv")}
              </Button>
            </div>
          ) : undefined
        }
      >
        {failed ? (
          <ErrorState title={t("loadFailed")} onRetry={retry} />
        ) : !report ? (
          <div aria-busy="true">
            <Skeleton lines={5} />
          </div>
        ) : report.days.length === 0 ? (
          <EmptyState title={t("noClasses")} description={t("noClassesHint")} />
        ) : (
          <div className="flex flex-col gap-3">
            <ReportLegend />
            <Table caption={t("monthCaption")} columns={columns} rows={report.students} getRowId={(row) => row.id} empty={<EmptyState title={t("noStudents")} />} />
          </div>
        )}
      </Card>

      {report && report.days.length > 0 ? (
        <PrintSheet organization={organization} title={t("monthTitle")} subtitle={`${sectionName} · ${monthName}`} legend={<ReportLegend />}>
          <table>
            <thead>
              <tr>
                <th>{t("columns.roll")}</th>
                <th>{t("columns.name")}</th>
                {report.days.map((day) => (
                  <th key={day.date}>{dayOf(day.date)}</th>
                ))}
                {COUNTS.map((key) => (
                  <th key={key}>{t(`short.${key}`)}</th>
                ))}
                <th>%</th>
              </tr>
            </thead>
            <tbody>
              {report.students.map((row) => (
                <tr key={row.id}>
                  <td>{row.roll_no ?? ""}</td>
                  <td>{row.full_name}</td>
                  {row.days.map((day, index) => (
                    <td key={report.days[index].date} className="text-center">
                      <DayCell day={day} />
                    </td>
                  ))}
                  {COUNTS.map((key) => (
                    <td key={key} className="text-right">
                      {format.number(row.counts[key])}
                    </td>
                  ))}
                  <td className="text-right">{pct(row.attendance_pct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </PrintSheet>
      ) : null}
    </div>
  );
};

export default MonthlyReport;
