import { act, cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderApp, renderWithIntl } from "@/i18n/test-utils";
import { addFlag, startProctoring } from "@/lib/features/proctoringSlice";
import ProctoringWarningModal from "./ProctoringWarningModal";
import QuestionNavigator, { isAnswered } from "./QuestionNavigator";

afterEach(() => cleanup());

const QUESTIONS = [
  { id: "q1", number: 1 },
  { id: "q2", number: 2 },
  { id: "q3", number: 3 },
];

describe("question navigator", () => {
  it("says which questions are answered or flagged, and jumps on click", () => {
    const onJump = vi.fn();
    renderWithIntl(
      <QuestionNavigator questions={QUESTIONS} answerState={{ q1: ["opt-a"], q2: "  " }} flagged={new Set(["q3"])} onJump={onJump} />,
    );

    expect(screen.getByText("1 of 3 answered")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Question 1, answered" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Question 2" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Question 3, flagged for review" }));
    expect(onJump).toHaveBeenCalledWith("q3");
  });

  it("uses Bangla digits and words on a Bangla page", () => {
    renderWithIntl(<QuestionNavigator questions={QUESTIONS} answerState={{ q2: "উত্তর" }} flagged={new Set()} onJump={vi.fn()} />, "bn");
    expect(screen.getByText("৩টির মধ্যে ১টির উত্তর দেওয়া হয়েছে")).toBeTruthy();
    expect(screen.getByRole("button", { name: "প্রশ্ন ২, উত্তর দেওয়া হয়েছে" }).textContent).toBe("২");
  });

  it("counts text, chosen options and recordings as answers", () => {
    expect(isAnswered(undefined)).toBe(false);
    expect(isAnswered("")).toBe(false);
    expect(isAnswered([])).toBe(false);
    expect(isAnswered("data:audio/webm;base64,AAA")).toBe(true);
    expect(isAnswered(["a"])).toBe(true);
  });
});

describe("proctoring warning", () => {
  it("explains the flag in one sentence and closes with I understand", async () => {
    const { store } = renderApp(<ProctoringWarningModal />);
    act(() => {
      store.dispatch(startProctoring());
      store.dispatch(addFlag({ type: "tab-switch", message: "Switched tab at 10:02" }));
    });

    const dialog = await screen.findByRole("dialog", { name: /Warning!/ });
    expect(within(dialog).getByText("You switched to another tab.")).toBeTruthy();
    expect(within(dialog).getByText("Current flag count: 1")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "I Understand" }));
    expect(store.getState().proctoring.pendingWarning).toBeNull();
  });
});
