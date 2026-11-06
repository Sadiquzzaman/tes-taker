import { describe, expect, it } from "vitest";
import { isRegisterError, registerCsv, registerFileName, registerRowsFromCsv } from "./paperRegister";

const REGISTER: PaperRegisterView = {
  section: { id: "s8a", name: "A", class_name: "Class 8" },
  month: "2026-11",
  today: "2026-11-15",
  mode: "PAPER_REGISTER",
  can_import: true,
  classes: [
    { header: "2026-11-07", date: "2026-11-07", start_time: "16:00", end_time: "17:30", slot_id: "x1" },
    { header: "2026-11-14 08:00", date: "2026-11-14", start_time: "08:00", end_time: "09:00", slot_id: "x2" },
    { header: "2026-11-14 16:00", date: "2026-11-14", start_time: "16:00", end_time: "17:30", slot_id: "x1" },
  ],
  students: [
    { id: "u1", full_name: "Rahim", roll_no: "1", marks: ["PRESENT", "LATE", null] },
    { id: "u2", full_name: "Karim, Jr.", roll_no: null, marks: ["ABSENT", "LEAVE", "PRESENT"] },
  ],
};

describe("paper register CSV (ATT-17, ATT-13)", () => {
  it("writes the template with empty marks and the export with the letters of the language", () => {
    expect(registerCsv(REGISTER, "en", { withMarks: false })).toBe(
      ["roll_no,name,2026-11-07,2026-11-14 08:00,2026-11-14 16:00", "1,Rahim,,,", ',"Karim, Jr.",,,'].join("\n"),
    );
    expect(registerCsv(REGISTER, "en", { withMarks: true }).split("\n").slice(1)).toEqual(["1,Rahim,P,L,", ',"Karim, Jr.",A,Leave,P']);
    expect(registerCsv(REGISTER, "bn", { withMarks: true }).split("\n").slice(1)).toEqual(["1,Rahim,উ,দে,", ',"Karim, Jr.",অ,ছু,উ']);
  });

  it("reads its own export back as the API takes it", () => {
    const text = `﻿${registerCsv(REGISTER, "en", { withMarks: true })}\r\n\r\n`;
    expect(registerRowsFromCsv(text)).toEqual({
      header: ["roll_no", "name", "2026-11-07", "2026-11-14 08:00", "2026-11-14 16:00"],
      rows: [{ cells: ["1", "Rahim", "P", "L", ""] }, { cells: ["", "Karim, Jr.", "A", "Leave", "P"] }],
    });
  });

  it("names the file after the section and month, and knows the register's error codes", () => {
    expect(registerFileName(REGISTER, "template")).toBe("class-8-a-2026-11-template.csv");
    expect(registerFileName({ ...REGISTER, section: { id: "s", name: "ক", class_name: "শ্রেণি ৮" } }, "register")).toBe("শ্রেণি-৮-ক-2026-11-register.csv");
    expect(isRegisterError("ATTENDANCE_REGISTER_SELF_CHECKIN")).toBe(true);
    expect(isRegisterError("ATTENDANCE_LEAVE_OVERLAP")).toBe(false);
  });
});
