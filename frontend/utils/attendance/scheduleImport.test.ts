import { describe, expect, it } from "vitest";
import { scheduleImportTemplate, scheduleRowsFromCsv } from "./scheduleImport";

describe("schedule CSV", () => {
  it("reads rows by header, with other spellings, quoted cells and blank lines", () => {
    const { rows, missing } = scheduleRowsFromCsv('﻿Class,Batch,Day,Start time,End time,Late after\n"Class 6",A,"Sat,Mon",16:00,17:30,5\n\n,,,,,\n');
    expect(missing).toEqual([]);
    expect(rows).toEqual([{ class: "Class 6", section: "A", days: "Sat,Mon", start: "16:00", end: "17:30", grace: "5" }]);
  });

  it("names the required columns a file lacks", () => {
    expect(scheduleRowsFromCsv("class,section,days\nClass 6,A,Sat").missing).toEqual(["start", "end"]);
  });

  it("offers a template that reads back cleanly", () => {
    const { rows, missing } = scheduleRowsFromCsv(scheduleImportTemplate());
    expect(missing).toEqual([]);
    expect(rows).toHaveLength(3);
    expect(rows[2]).toMatchObject({ class: "Class 6", section: "B", days: "Sun;Tue;Thu", start: "9:00 AM", grace: "5" });
  });
});
