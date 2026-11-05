import { parseCsvText } from "@/utils/classes/addStudentModal";

/** The columns of the schedule CSV (ATT-16), in template order. The first five are needed. */
export const SCHEDULE_IMPORT_COLUMNS = ["class", "section", "days", "start", "end", "class_type", "mode", "grace", "branch"] as const;
const REQUIRED: ScheduleImportColumn[] = ["class", "section", "days", "start", "end"];

export type ScheduleImportColumn = (typeof SCHEDULE_IMPORT_COLUMNS)[number];
export type ScheduleImportRow = Partial<Record<ScheduleImportColumn, string>>;

/** The API takes at most this many rows per file. */
export const MAX_SCHEDULE_ROWS = 1000;

/** Other spellings people use for the headers (English and Bangla). */
const ALIASES: Record<string, ScheduleImportColumn> = {
  batch: "section",
  course: "class",
  day: "days",
  start_time: "start",
  from: "start",
  end_time: "end",
  to: "end",
  type: "class_type",
  attendance: "mode",
  attendance_mode: "mode",
  late_after: "grace",
  grace_minutes: "grace",
  ক্লাস: "class",
  শাখা: "branch",
  দিন: "days",
  শুরু: "start",
  শেষ: "end",
};

const headerKey = (header: string): ScheduleImportColumn | null => {
  const key = header.replace(/^﻿/, "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if ((SCHEDULE_IMPORT_COLUMNS as readonly string[]).includes(key)) return key as ScheduleImportColumn;
  return ALIASES[key] ?? null;
};

/**
 * The rows of a schedule CSV, keyed by column. The first line is the header; blank lines are
 * skipped. `missing` lists required columns the header lacks.
 */
export const scheduleRowsFromCsv = (text: string) => {
  const [header = [], ...lines] = parseCsvText(text);
  const columns = header.map(headerKey);
  const rows = lines
    .filter((line) => line.some((value) => value.trim() !== ""))
    .map((line) =>
      columns.reduce<ScheduleImportRow>((row, column, index) => {
        if (column) row[column] = (line[index] ?? "").trim();
        return row;
      }, {}),
    );
  const missing = REQUIRED.filter((column) => !columns.includes(column));
  return { rows, missing };
};

/** A template with the header and example rows (one section can have several lines). */
export const scheduleImportTemplate = () =>
  [
    SCHEDULE_IMPORT_COLUMNS.join(","),
    "Class 6,A,Sat;Mon,16:00,17:30,In person,Self check-in,,",
    "Class 6,A,Wed,18:00,19:00,,,,",
    "Class 6,B,Sun;Tue;Thu,9:00 AM,10:30 AM,Online,Self check-in,5,",
  ].join("\n");

export const downloadScheduleImportTemplate = () => {
  // A byte-order mark so Excel opens Bangla names correctly.
  const blob = new Blob(["﻿", scheduleImportTemplate()], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "schedule-import-template.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
