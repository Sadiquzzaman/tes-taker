import { parseCsvText } from "@/utils/classes/addStudentModal";

/** The columns of the student CSV (FND-04), in template order. */
export const STUDENT_IMPORT_COLUMNS = [
  "name",
  "phone",
  "email",
  "section",
  "roll_no",
  "guardian1_name",
  "guardian1_relation",
  "guardian1_phone",
  "guardian2_name",
  "guardian2_relation",
  "guardian2_phone",
] as const;

export type StudentImportColumn = (typeof STUDENT_IMPORT_COLUMNS)[number];
export type StudentImportRow = Partial<Record<StudentImportColumn, string>>;

/** The API takes at most this many rows per import. */
export const MAX_IMPORT_ROWS = 500;

/** Other spellings people use for the headers. */
const ALIASES: Record<string, StudentImportColumn> = {
  student_name: "name",
  full_name: "name",
  mobile: "phone",
  phone_number: "phone",
  roll: "roll_no",
  roll_number: "roll_no",
};

const headerKey = (header: string): StudentImportColumn | null => {
  const key = header.replace(/^﻿/, "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if ((STUDENT_IMPORT_COLUMNS as readonly string[]).includes(key)) return key as StudentImportColumn;
  return ALIASES[key] ?? null;
};

/**
 * The rows of a student CSV, keyed by column. The first line must be the header; blank lines are
 * skipped. `unknownHeaders` lists columns that were ignored; `missing` is true without a name column
 * or without both phone and email columns.
 */
export const studentRowsFromCsv = (text: string) => {
  const [header = [], ...lines] = parseCsvText(text);
  const columns = header.map(headerKey);
  const unknownHeaders = header.filter((h, i) => h.trim() && !columns[i]).map((h) => h.trim());
  const rows = lines
    .filter((line) => line.some((value) => value.trim() !== ""))
    .map((line) =>
      columns.reduce<StudentImportRow>((row, column, index) => {
        if (column) row[column] = (line[index] ?? "").trim();
        return row;
      }, {}),
    );
  const missing = !columns.includes("name") || (!columns.includes("phone") && !columns.includes("email"));
  return { rows, unknownHeaders, missing };
};

/** A template with the header and one example row (synthetic values). */
export const studentImportTemplate = () =>
  [
    STUDENT_IMPORT_COLUMNS.join(","),
    ["Student Name", "01XXXXXXXXX", "student@example.com", "A", "1", "Father Name", "Father", "01XXXXXXXXX", "Mother Name", "Mother", "01XXXXXXXXX"].join(","),
  ].join("\n");

export const downloadStudentImportTemplate = () => {
  // A byte-order mark so Excel opens Bangla names correctly.
  const blob = new Blob(["﻿", studentImportTemplate()], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "student-import-template.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
