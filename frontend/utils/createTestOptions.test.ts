import { describe, expect, it } from "vitest";
import { CREATE_TEST_GRADED_TRUE_FALSE_SUBTYPE_ID, createTestQuestionCategoryOptions } from "./createTestOptions";

// The server's IELTS question names (backend/src/exams/enums/question.enums.ts); any other name is refused.
const SERVER_IELTS_SUB_TYPES = [
  "multiple-choice",
  "multiple-response",
  "true-false-not-given",
  "yes-no-not-given",
  "matching-ordering",
  "fill-in-the-blanks",
  "sentence-completion",
  "summary-completion",
  "table-completion",
  "diagram-label",
  "short-answer",
  "writing-task-1",
  "writing-task-2",
  "speaking-part-1",
  "speaking-part-2",
  "speaking-part-3",
];

const tabIds = (categoryId: string) =>
  createTestQuestionCategoryOptions.find((category) => category.id === categoryId)?.tabs.map((tab) => tab.id) ?? [];

describe("create test question types", () => {
  it("the IELTS tab sends only names the server accepts, with True / False / Not Given as true-false-not-given", () => {
    const ielts = tabIds("ielts");
    expect(ielts).toContain("true-false-not-given");
    expect(ielts).not.toContain("true-false");
    expect(ielts.filter((id) => !SERVER_IELTS_SUB_TYPES.includes(id))).toEqual([]);
  });

  it("the academic True / False keeps its name", () => {
    expect(tabIds("graded")).toContain(CREATE_TEST_GRADED_TRUE_FALSE_SUBTYPE_ID);
    expect(CREATE_TEST_GRADED_TRUE_FALSE_SUBTYPE_ID).toBe("true-false");
  });
});
