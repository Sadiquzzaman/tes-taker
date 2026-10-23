import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mapReasonCodeToMessageVariant } from "@/hooks/api/exam/useExamEligibility";
import ExamMessageScreen from "./ExamMessageScreen";

vi.mock("@/hooks/api/useApiError", () => ({ useApiError: () => ({ handleError: vi.fn() }) }));

afterEach(() => cleanup());

describe("exam full message", () => {
  it("maps the EXAM_FULL eligibility code to the exam-full screen", () => {
    expect(mapReasonCodeToMessageVariant("EXAM_FULL")).toBe("exam-full");
  });

  it("keeps the existing reason codes mapped as before", () => {
    expect(mapReasonCodeToMessageVariant("NOT_ASSIGNED")).toBe("not-assigned");
    expect(mapReasonCodeToMessageVariant("ENDED")).toBe("exam-ended");
    expect(mapReasonCodeToMessageVariant("OK")).toBeNull();
  });

  it("tells the student the exam is full and to contact their teacher", () => {
    render(<ExamMessageScreen variant="exam-full" />);

    expect(screen.getByText("Exam is full")).toBeTruthy();
    expect(screen.getByText(/reached the student limit of your teacher's plan/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to Tests" })).toBeTruthy();
  });
});
