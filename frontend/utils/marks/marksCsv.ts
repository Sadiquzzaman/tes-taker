import { toCsv } from "@/utils/attendance/paperRegister";
import { parseCsvText } from "@/utils/classes/addStudentModal";

/** Words that mean "absent" in a marks cell or the absent column (English or Bangla). */
const ABSENT = new Set(["a", "ab", "abs", "absent", "yes", "y", "1", "অ", "অনুপস্থিত", "হ্যাঁ"]);
const BANGLA_DIGITS = "০১২৩৪৫৬৭৮৯";

/** "৭২.৫" → "72.5" */
const latinDigits = (value: string) => value.replace(/[০-৯]/g, (d) => String(BANGLA_DIGITS.indexOf(d)));

/** The columns of a marks sheet: roll, name, one column per part (or "marks"), absent. */
export const marksColumns = (exam: Pick<PaperExam, "parts">) => ["roll_no", "name", ...(exam.parts?.length ? exam.parts.map((part) => part.name) : ["marks"]), "absent"];

/** The marks sheet to fill in (or the marks so far): one line per student. */
export const marksCsv = (grid: PaperMarksGrid) =>
  toCsv([
    marksColumns(grid.exam),
    ...grid.rows.map((row) => [
      row.student.roll_no ?? "",
      row.student.full_name,
      ...(grid.exam.parts?.length
        ? grid.exam.parts.map((part) => (row.part_marks?.[part.name] !== undefined ? String(row.part_marks[part.name]) : ""))
        : [row.marks === null ? "" : String(row.marks)]),
      row.is_absent ? "absent" : "",
    ]),
  ]);

/** "class-6-a-math-half-yearly-exam.csv" */
export const marksFileName = (exam: PaperExam) =>
  `${exam.offering.section.class_name ?? ""} ${exam.offering.section.name} ${exam.offering.subject.name} ${exam.name}`
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "")
    .concat(".csv");

export type MarksSheetProblem = { line: number; reason: "STUDENT_UNKNOWN" | "NUMBER_INVALID" | "COLUMNS_MISSING" };

/**
 * A filled-in marks sheet as rows for the grid: each line is matched to a student by roll number,
 * else by name; a number in each part column (or the marks column), or absent. Empty lines and
 * students left blank are skipped. The server checks the marks against the total and the parts.
 */
export const marksFromCsv = (text: string, grid: PaperMarksGrid): { rows: PaperMarkInput[]; problems: MarksSheetProblem[] } => {
  const [header = [], ...lines] = parseCsvText(text);
  const columns = header.map((cell) => cell.replace(/^﻿/, "").trim().toLowerCase());
  const at = (name: string) => columns.indexOf(name.toLowerCase());
  const partNames = grid.exam.parts?.length ? grid.exam.parts.map((part) => part.name) : null;
  const valueColumns = (partNames ?? ["marks"]).map(at);
  if (valueColumns.some((index) => index < 0) || (at("roll_no") < 0 && at("name") < 0)) {
    return { rows: [], problems: [{ line: 1, reason: "COLUMNS_MISSING" }] };
  }
  const rows: PaperMarkInput[] = [];
  const problems: MarksSheetProblem[] = [];
  lines.forEach((cells, index) => {
    const line = index + 2;
    if (!cells.some((cell) => cell.trim() !== "")) return;
    const roll = latinDigits(cells[at("roll_no")]?.trim() ?? "");
    const name = (cells[at("name")] ?? "").trim().toLowerCase();
    const student =
      (roll && grid.rows.find((row) => row.student.roll_no !== null && latinDigits(row.student.roll_no) === roll)) ||
      (name && grid.rows.find((row) => row.student.full_name.trim().toLowerCase() === name));
    if (!student) {
      problems.push({ line, reason: "STUDENT_UNKNOWN" });
      return;
    }
    const values = valueColumns.map((column) => latinDigits(cells[column]?.trim() ?? ""));
    const absent = ABSENT.has((cells[at("absent")] ?? "").trim().toLowerCase()) || values.some((value) => ABSENT.has(value.toLowerCase()) && !/^\d/.test(value));
    if (absent) {
      rows.push({ student_id: student.student.id, is_absent: true });
      return;
    }
    if (values.every((value) => value === "")) return;
    const numbers = values.map((value) => (value === "" ? null : Number(value)));
    if (numbers.some((value) => value !== null && !Number.isFinite(value))) {
      problems.push({ line, reason: "NUMBER_INVALID" });
      return;
    }
    if (partNames) {
      const partMarks: Record<string, number> = {};
      partNames.forEach((part, i) => {
        if (numbers[i] !== null) partMarks[part] = numbers[i] as number;
      });
      rows.push({ student_id: student.student.id, part_marks: partMarks, is_absent: false });
    } else {
      rows.push({ student_id: student.student.id, marks: numbers[0], is_absent: false });
    }
  });
  return { rows, problems };
};
