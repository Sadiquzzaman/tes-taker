"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Badge, Button, Card, DatePicker, EmptyState, ErrorState, Skeleton, Table, type TableColumn } from "@/design/ui";
import useFormat from "@/i18n/useFormat";
import { downloadCsv } from "@/utils/attendance/paperRegister";
import { monthRange, teacherReportCsv, teacherReportFileName } from "@/utils/attendance/reports";
import { STATUS_TONE } from "@/utils/attendance/status";
import PrintSheet from "./PrintSheet";
import { ReportLegend } from "./ReportMarks";
import useReport from "./useReport";

type TeacherRow = TeacherAttendanceReport["teachers"][number];
type ClassRow = TeacherRow["classes"][number] & { teacher: string; key: string };
const COUNTS = ["present", "late", "absent", "leave"] as const;

/**
 * The teacher report (ATT-11, ATT-13), for owners and admins: each teacher's classes from a date to
 * a date (at most 31 days; today by default, which is the daily list of late and absent teachers),
 * with counts, %, minutes late and the classes that were not on time. Printable and as CSV.
 */
const TeacherReport = ({ organization }: { organization: string | null }) => {
  const t = useTranslations("reports");
  const tStatus = useTranslations("myAttendance.status");
  const format = useFormat();
  const [range, setRange] = useState<{ from: string; to: string }>({ from: "", to: "" });
  const { report, latest, failed, retry } = useReport<TeacherAttendanceReport>("/attendance/reports/teachers", {
    from: range.from || undefined,
    to: range.to || undefined,
  });
  const from = range.from || latest?.from || "";
  const to = range.to || latest?.to || "";
  const today = latest?.today ?? "";
  const dateName = (date: string) => format.date(`${date}T00:00:00Z`, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const period = report ? (report.from === report.to ? dateName(report.from) : `${dateName(report.from)} – ${dateName(report.to)}`) : "";
  const pct = (value: number | null) => (value === null ? "—" : `${format.number(value)}%`);

  const columns: TableColumn<TeacherRow>[] = [
    { key: "name", header: t("columns.teacher"), cell: (row) => <span className="font-medium text-ink">{row.teacher.full_name}</span>, sortValue: (row) => row.teacher.full_name },
    ...COUNTS.map(
      (key): TableColumn<TeacherRow> => ({
        key,
        header: t(`columns.${key}`),
        align: "right",
        cell: (row) => format.number(row.counts[key]),
        sortValue: (row) => row.counts[key],
      }),
    ),
    { key: "pct", header: t("columns.pct"), align: "right", cell: (row) => pct(row.attendance_pct), sortValue: (row) => row.attendance_pct ?? -1 },
    { key: "minutes", header: t("columns.lateMinutes"), align: "right", cell: (row) => format.number(row.late_minutes), sortValue: (row) => row.late_minutes },
  ];
  const classes: ClassRow[] = (report?.teachers ?? []).flatMap((row) =>
    row.classes.map((item, index) => ({ ...item, teacher: row.teacher.full_name, key: `${row.teacher.id}-${index}` })),
  );
  const classColumns: TableColumn<ClassRow>[] = [
    { key: "teacher", header: t("columns.teacher"), cell: (row) => row.teacher, sortValue: (row) => row.teacher },
    { key: "date", header: t("columns.date"), cell: (row) => dateName(row.date), sortValue: (row) => `${row.date} ${row.start_time}` },
    { key: "time", header: t("columns.time"), cell: (row) => `${row.start_time}–${row.end_time}` },
    { key: "section", header: t("section"), cell: (row) => `${row.section.class_name} ${row.section.name}` },
    {
      key: "status",
      header: t("columns.status"),
      cell: (row) => (
        <Badge tone={STATUS_TONE[row.status]}>
          {tStatus(row.status)}
          {row.late_minutes !== null ? ` · ${t("minutesLate", { minutes: row.late_minutes })}` : ""}
        </Badge>
      ),
    },
  ];
  const headers = [t("columns.teacher"), ...COUNTS.map((key) => t(`columns.${key}`)), t("columns.pct"), t("columns.lateMinutes")];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
        <DatePicker label={t("from")} value={from} onChange={(value) => setRange({ from: value, to: to && to >= value ? to : value })} fieldClassName="sm:w-48" />
        <DatePicker label={t("to")} value={to} min={from || undefined} onChange={(value) => setRange({ from, to: value })} fieldClassName="sm:w-48" />
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" disabled={!today} onClick={() => setRange({ from: today, to: today })}>
            {t("today")}
          </Button>
          <Button variant="secondary" size="sm" disabled={!today} onClick={() => setRange(monthRange(today.slice(0, 7)))}>
            {t("thisMonth")}
          </Button>
        </div>
      </div>

      <Card
        title={t("teachersTitle")}
        description={period ? `${period} · ${t("teachersHint")}` : t("teachersHint")}
        actions={
          report && report.teachers.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => window.print()}>
                {t("print")}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => downloadCsv(teacherReportFileName(report), teacherReportCsv(report, headers))}>
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
            <Skeleton lines={4} />
          </div>
        ) : report.teachers.length === 0 ? (
          <EmptyState title={t("noTeachers")} description={t("noTeachersHint")} />
        ) : (
          <div className="flex flex-col gap-6">
            <Table caption={t("teachersCaption")} columns={columns} rows={report.teachers} getRowId={(row) => row.teacher.id} />
            <div className="flex flex-col gap-2">
              <h3 className="text-body font-semibold text-ink">{t("notOnTime")}</h3>
              <Table caption={t("notOnTime")} columns={classColumns} rows={classes} getRowId={(row) => row.key} empty={<EmptyState title={t("allOnTime")} />} />
            </div>
          </div>
        )}
      </Card>

      {report && report.teachers.length > 0 ? (
        <PrintSheet organization={organization} title={t("teachersTitle")} subtitle={period} legend={<ReportLegend missed={false} />}>
          <table className="print-block mb-3">
            <thead>
              <tr>
                {headers.map((header) => (
                  <th key={header}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.teachers.map((row) => (
                <tr key={row.teacher.id}>
                  <td>{row.teacher.full_name}</td>
                  {COUNTS.map((key) => (
                    <td key={key} className="text-right">
                      {format.number(row.counts[key])}
                    </td>
                  ))}
                  <td className="text-right">{pct(row.attendance_pct)}</td>
                  <td className="text-right">{format.number(row.late_minutes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {classes.length > 0 ? (
            <table>
              <thead>
                <tr>
                  {[t("columns.teacher"), t("columns.date"), t("columns.time"), t("section"), t("columns.status")].map((header) => (
                    <th key={header}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {classes.map((row) => (
                  <tr key={row.key}>
                    <td>{row.teacher}</td>
                    <td>{dateName(row.date)}</td>
                    <td>
                      {row.start_time}–{row.end_time}
                    </td>
                    <td>
                      {row.section.class_name} {row.section.name}
                    </td>
                    <td>
                      {tStatus(row.status)}
                      {row.late_minutes !== null ? ` · ${t("minutesLate", { minutes: row.late_minutes })}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </PrintSheet>
      ) : null}
    </div>
  );
};

export default TeacherReport;
