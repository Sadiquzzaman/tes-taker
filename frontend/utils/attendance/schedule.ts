import { SCHOOL_WEEK } from "@/utils/schoolDate";

/** A weekly slot as the API takes it: ISO day, "HH:MM" times, an optional teacher. */
export interface SlotInput {
  day_of_week: number;
  start_time: string;
  end_time: string;
  teacher_id: string | null;
}

/** One line of the schedule editor: the same times (and teacher) on several days. */
export interface ScheduleRow {
  days: number[];
  start: string;
  end: string;
  teacher_id: string | null;
}

const weekOrder = (day: number) => SCHOOL_WEEK.indexOf(day as (typeof SCHOOL_WEEK)[number]);
const byWeek = (a: number, b: number) => weekOrder(a) - weekOrder(b);

/** Slots grouped into editor rows (same start, end and teacher), rows in time order, days Saturday first. */
export const rowsFromSlots = (slots: SlotInput[]): ScheduleRow[] => {
  const rows: ScheduleRow[] = [];
  for (const slot of slots) {
    const row = rows.find((r) => r.start === slot.start_time && r.end === slot.end_time && r.teacher_id === slot.teacher_id);
    if (row) row.days.push(slot.day_of_week);
    else rows.push({ days: [slot.day_of_week], start: slot.start_time, end: slot.end_time, teacher_id: slot.teacher_id });
  }
  for (const row of rows) row.days.sort(byWeek);
  return rows.sort((a, b) => a.start.localeCompare(b.start) || byWeek(a.days[0], b.days[0]));
};

/** Editor rows back to slots, with the row each slot came from (to point at the API's `details.slot`). */
export const slotsFromRows = (rows: ScheduleRow[]): { slots: SlotInput[]; rowOf: number[] } => {
  const slots: SlotInput[] = [];
  const rowOf: number[] = [];
  rows.forEach((row, index) => {
    for (const day of [...row.days].sort(byWeek)) {
      slots.push({ day_of_week: day, start_time: row.start, end_time: row.end, teacher_id: row.teacher_id });
      rowOf.push(index);
    }
  });
  return { slots, rowOf };
};

export type RowProblem = "noDays" | "noTimes" | "endBeforeStart" | "overlap";

/** What is wrong with each row before saving (the API checks the same, plus teacher clashes). */
export const rowProblems = (rows: ScheduleRow[]): (RowProblem | null)[] =>
  rows.map((row, index) => {
    if (row.days.length === 0) return "noDays";
    if (!row.start || !row.end) return "noTimes";
    if (row.end <= row.start) return "endBeforeStart";
    const clash = rows.some(
      (other, i) =>
        i !== index && other.start && other.end && other.days.some((d) => row.days.includes(d)) && row.start < other.end && other.start < row.end,
    );
    return clash ? "overlap" : null;
  });
