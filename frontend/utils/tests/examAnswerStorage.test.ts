import { afterEach, describe, expect, it } from "vitest";
import { clearExamAnswersFromStorage, loadExamAnswersFromStorage, saveExamAnswersToStorage } from "./examAnswerStorage";

const answers = { q1: "A" } as unknown as ExamAnswerState;

afterEach(() => localStorage.clear());

describe("answers kept on the device", () => {
  it("brings back the answers of the same attempt", () => {
    saveExamAnswersToStorage("e1", "s1", answers, "2026-11-13T05:00:00.000Z");
    expect(loadExamAnswersFromStorage("e1", "s1", "2026-11-13T05:00:00.000Z")).toEqual(answers);
  });

  it("never brings back an earlier attempt's answers on a retake (P8-04)", () => {
    saveExamAnswersToStorage("e1", "s1", answers, "2026-11-13T05:00:00.000Z");
    expect(loadExamAnswersFromStorage("e1", "s1", "2026-11-13T06:00:00.000Z")).toBeNull();
  });

  it("keeps answers saved before attempts were recorded, and clears them", () => {
    saveExamAnswersToStorage("e1", "s1", answers);
    expect(loadExamAnswersFromStorage("e1", "s1", "2026-11-13T05:00:00.000Z")).toEqual(answers);
    clearExamAnswersFromStorage("e1", "s1");
    expect(loadExamAnswersFromStorage("e1", "s1")).toBeNull();
  });
});
