import { toCsv } from "./paperRegister";

/** The calendar colour a day of the reports takes (`STATUS_MARK`): a day still waiting shows as upcoming. */
export const DAY_COLOUR: Record<ReportDayStatus, CalendarStatus> = {
  PRESENT: "PRESENT",
  LATE: "LATE",
  ABSENT: "ABSENT",
  LEAVE: "LEAVE",
  WAITING: "UPCOMING",
};

/**
 * The groups of the daily summary, most urgent first: absent all day, at some classes but missed
 * others, late, on leave, still waiting, present.
 */
export const DAILY_GROUPS = ["ABSENT", "MISSED_SOME", "LATE", "LEAVE", "WAITING", "PRESENT"] as const;
export type DailyGroup = (typeof DAILY_GROUPS)[number];

/** The group a student's day falls in (null: no class counted for them that day). */
export const dailyGroup = (day: ReportDayMark | null): DailyGroup | null => {
  if (!day) return null;
  if ((day.status === "PRESENT" || day.status === "LATE") && day.missed > 0) return "MISSED_SOME";
  return day.status;
};

/** "YYYY-MM-01" and the month's last day. */
export const monthRange = (month: string): { from: string; to: string } => {
  const [year, mon] = month.split("-").map(Number);
  const last = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
};

/**
 * The teacher report as CSV (Excel opens it with Bangla intact; `downloadCsv` adds the byte-order
 * mark): one line per teacher with their counts, % and minutes late, under headers in the user's language.
 */
export const teacherReportCsv = (report: TeacherAttendanceReport, headers: string[]) =>
  toCsv([
    headers,
    ...report.teachers.map((row) => [
      row.teacher.full_name,
      String(row.counts.present),
      String(row.counts.late),
      String(row.counts.absent),
      String(row.counts.leave),
      row.attendance_pct === null ? "" : String(row.attendance_pct),
      String(row.late_minutes),
    ]),
  ]);

/** "teachers-2026-11-01-2026-11-30.csv". */
export const teacherReportFileName = (report: TeacherAttendanceReport) =>
  report.from === report.to ? `teachers-${report.from}.csv` : `teachers-${report.from}-${report.to}.csv`;

/** API error codes the report screens explain themselves (messages `reports.errors`). */
export const REPORT_ERRORS = [
  "ATTENDANCE_REPORT_DATE_INVALID",
  "ATTENDANCE_REPORT_RANGE_INVALID",
  "ATTENDANCE_REPORT_RANGE_TOO_LONG",
  "ATTENDANCE_REPORT_SECTION_NOT_FOUND",
  "ATTENDANCE_REGISTER_SECTION_NOT_FOUND",
  "ATTENDANCE_REGISTER_SESSION_CLOSED",
] as const;
export type ReportErrorCode = (typeof REPORT_ERRORS)[number];
export const isReportError = (code: unknown): code is ReportErrorCode => REPORT_ERRORS.includes(code as ReportErrorCode);
