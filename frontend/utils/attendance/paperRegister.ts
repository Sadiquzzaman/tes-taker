import { parseCsvText } from "@/utils/classes/addStudentModal";

/** The two student columns of the register CSV (ATT-17); the class days follow. */
export const REGISTER_STUDENT_COLUMNS = ["roll_no", "name"] as const;

/** The API takes at most this many lines (students) and columns per file. */
export const MAX_REGISTER_ROWS = 1000;
export const MAX_REGISTER_COLUMNS = 250;

/** The letters written in a file, in the user's language; the import reads both languages. */
export const MARK_LETTERS: Record<"en" | "bn", Record<AttendanceStatus, string>> = {
  en: { PRESENT: "P", LATE: "L", ABSENT: "A", LEAVE: "LV" },
  bn: { PRESENT: "উ", LATE: "দে", ABSENT: "অ", LEAVE: "ছু" },
};

/** A cell quoted when it holds a comma, a quote or a line break. */
const csvCell = (value: string) => (/[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

/** Lines of cells as CSV text (`downloadCsv` adds the byte-order mark). */
export const toCsv = (lines: string[][]) => lines.map((line) => line.map(csvCell).join(",")).join("\n");

/**
 * The register as CSV: roll number, name, one column per class day. The template leaves the marks
 * empty; the export (ATT-13) fills them in with the letters of `language`, so it can be imported again.
 */
export const registerCsv = (register: PaperRegisterView, language: "en" | "bn", { withMarks }: { withMarks: boolean }) =>
  toCsv([
    [...REGISTER_STUDENT_COLUMNS, ...register.classes.map((item) => item.header)],
    ...register.students.map((student) => [
      student.roll_no ?? "",
      student.full_name,
      ...student.marks.map((mark) => (withMarks && mark ? MARK_LETTERS[language][mark] : "")),
    ]),
  ]);

/** "class-8-a-2026-11-register.csv" (or "-template"). */
export const registerFileName = (register: PaperRegisterView, kind: "register" | "template") =>
  `${register.section.class_name} ${register.section.name} ${register.month} ${kind}`
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "")
    .concat(".csv");

export const downloadCsv = (fileName: string, text: string) => {
  // A byte-order mark so Excel opens Bangla names correctly.
  const blob = new Blob(["\uFEFF", text], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * A register CSV as the API takes it: the header and each line's cells. Blank lines are skipped;
 * the server finds the roll and name columns and checks every cell.
 */
export const registerRowsFromCsv = (text: string) => {
  const [header = [], ...lines] = parseCsvText(text);
  return {
    header: header.map((cell) => cell.replace(/^\uFEFF/, "").trim()),
    rows: lines.filter((line) => line.some((value) => value.trim() !== "")).map((cells) => ({ cells: cells.map((cell) => cell.trim()) })),
  };
};

/** API error codes the register screens explain themselves (messages `register.errors`). */
export const REGISTER_ERRORS = [
  "ATTENDANCE_REGISTER_SECTION_NOT_FOUND",
  "ATTENDANCE_REGISTER_MONTH_INVALID",
  "ATTENDANCE_REGISTER_SELF_CHECKIN",
  "ATTENDANCE_REGISTER_SESSION_CLOSED",
  "ATTENDANCE_REGISTER_COLUMNS_MISSING",
  "ATTENDANCE_REGISTER_INVALID",
  "ATTENDANCE_REGISTER_CHANGED",
] as const;
export type RegisterErrorCode = (typeof REGISTER_ERRORS)[number];
export const isRegisterError = (code: unknown): code is RegisterErrorCode => REGISTER_ERRORS.includes(code as RegisterErrorCode);
