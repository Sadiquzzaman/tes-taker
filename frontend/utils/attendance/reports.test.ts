import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadCsv } from "./paperRegister";
import { dailyGroup, isReportError, monthRange, teacherReportCsv, teacherReportFileName } from "./reports";

const report: TeacherAttendanceReport = {
  from: "2026-11-01",
  to: "2026-11-30",
  today: "2026-11-15",
  teachers: [
    { teacher: { id: "t1", full_name: "রিনা আক্তার" }, counts: { present: 3, late: 1, absent: 0, leave: 2 }, attendance_pct: 100, late_minutes: 12, classes: [] },
    { teacher: { id: "t2", full_name: "Hasan, M." }, counts: { present: 0, late: 0, absent: 0, leave: 1 }, attendance_pct: null, late_minutes: 0, classes: [] },
  ],
};

describe("attendance report helpers (ATT-13)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("puts a student's day in one group of the daily summary", () => {
    expect(dailyGroup({ status: "PRESENT", missed: 2, waiting: 0 })).toBe("MISSED_SOME");
    expect(dailyGroup({ status: "LATE", missed: 1, waiting: 0 })).toBe("MISSED_SOME");
    expect(dailyGroup({ status: "LATE", missed: 0, waiting: 0 })).toBe("LATE");
    expect(dailyGroup({ status: "ABSENT", missed: 0, waiting: 2 })).toBe("ABSENT");
    expect(dailyGroup(null)).toBeNull();
  });

  it("gives a month's first and last day", () => {
    expect(monthRange("2026-11")).toEqual({ from: "2026-11-01", to: "2026-11-30" });
    expect(monthRange("2028-02")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
  });

  it("writes the teacher report as CSV with the headers given, quoting where needed", () => {
    const text = teacherReportCsv(report, ["শিক্ষক", "উপস্থিত", "দেরি", "অনুপস্থিত", "ছুটি", "হার", "মিনিট"]);
    expect(text.split("\n")).toEqual(["শিক্ষক,উপস্থিত,দেরি,অনুপস্থিত,ছুটি,হার,মিনিট", "রিনা আক্তার,3,1,0,2,100,12", '"Hasan, M.",0,0,0,1,,0']);
    expect(teacherReportFileName(report)).toBe("teachers-2026-11-01-2026-11-30.csv");
    expect(teacherReportFileName({ ...report, to: report.from })).toBe("teachers-2026-11-01.csv");
  });

  it("downloads CSV with a UTF-8 byte-order mark so Excel keeps Bangla", async () => {
    let blob: Blob | null = null;
    Object.assign(URL, { createObjectURL: vi.fn((value: Blob) => ((blob = value), "blob:report")), revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    downloadCsv("teachers.csv", teacherReportCsv(report, ["শিক্ষক", "P", "L", "A", "LV", "%", "min"]));
    expect(click).toHaveBeenCalledTimes(1);
    // jsdom's Blob has no arrayBuffer(); FileReader reads the raw bytes.
    const bytes = await new Promise<Uint8Array>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
      reader.readAsArrayBuffer(blob as unknown as Blob);
    });
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes)).toBe(`\uFEFF${teacherReportCsv(report, ["শিক্ষক", "P", "L", "A", "LV", "%", "min"])}`);
    expect((blob as unknown as Blob).type).toBe("text/csv;charset=utf-8;");
  });

  it("knows the report error codes it explains", () => {
    expect(isReportError("ATTENDANCE_REPORT_RANGE_TOO_LONG")).toBe(true);
    expect(isReportError("ATTENDANCE_LEAVE_OVERLAP")).toBe(false);
  });
});
