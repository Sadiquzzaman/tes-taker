import { describe, expect, it } from "vitest";
import { rowProblems, rowsFromSlots, slotsFromRows } from "./schedule";

const slot = (day: number, start: string, end: string, teacher: string | null = null) => ({ day_of_week: day, start_time: start, end_time: end, teacher_id: teacher });

describe("schedule rows", () => {
  it("groups slots with the same times and teacher into one row, Saturday first", () => {
    const rows = rowsFromSlots([slot(1, "16:00", "17:30"), slot(3, "18:00", "19:00"), slot(6, "16:00", "17:30"), slot(2, "16:00", "17:30", "t1")]);
    expect(rows).toEqual([
      { days: [6, 1], start: "16:00", end: "17:30", teacher_id: null },
      { days: [2], start: "16:00", end: "17:30", teacher_id: "t1" },
      { days: [3], start: "18:00", end: "19:00", teacher_id: null },
    ]);
  });

  it("expands rows back to slots and remembers each slot's row", () => {
    const { slots, rowOf } = slotsFromRows([
      { days: [1, 6], start: "16:00", end: "17:30", teacher_id: null },
      { days: [3], start: "18:00", end: "19:00", teacher_id: "t1" },
    ]);
    expect(slots).toEqual([slot(6, "16:00", "17:30"), slot(1, "16:00", "17:30"), slot(3, "18:00", "19:00", "t1")]);
    expect(rowOf).toEqual([0, 0, 1]);
  });

  it("finds rows without days or times, reversed times and overlaps on a shared day", () => {
    expect(
      rowProblems([
        { days: [], start: "09:00", end: "10:00", teacher_id: null },
        { days: [6], start: "", end: "10:00", teacher_id: null },
        { days: [6], start: "11:00", end: "10:00", teacher_id: null },
        { days: [6, 1], start: "16:00", end: "17:30", teacher_id: null },
        { days: [1], start: "17:00", end: "18:00", teacher_id: null },
        { days: [6], start: "17:30", end: "18:30", teacher_id: null },
      ]),
    ).toEqual(["noDays", "noTimes", "endBeforeStart", "overlap", "overlap", null]);
  });
});
