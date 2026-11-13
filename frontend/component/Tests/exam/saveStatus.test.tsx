import { cleanup, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/i18n/test-utils";
import type { AnswerSaveStatus } from "@/hooks/tests/useAnswerSync";
import StudentExamMain from "./StudentExamMain";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/test" }));

const exam = {
  id: "e1",
  test_name: "Physics quiz",
  status: "ongoing",
  formState: { duration: 30, allowNegativeMarking: false },
  publishState: {},
  subjects: [],
  class_id: null,
  class_name: null,
  remaining_time_seconds: 600,
} as unknown as StudentExamDetails;

const show = (saveStatus: AnswerSaveStatus) =>
  renderApp(
    <StudentExamMain
      exam={exam}
      answerState={{}}
      isInteractionDisabled={false}
      isSubmitLoading={false}
      submitButtonRef={createRef<HTMLButtonElement>()}
      saveStatus={saveStatus}
      onAnswerChange={vi.fn()}
      onMatchingChange={vi.fn()}
      onSubmit={vi.fn()}
      onCountdownStart={vi.fn()}
      onTimeUp={vi.fn()}
    />,
  );

afterEach(() => cleanup());

describe("where the answers are saved (PRO-09)", () => {
  it.each([
    ["device", "Saved on this device"],
    ["saving", "Saving…"],
    ["server", "Saved to server"],
  ] as const)("shows %s", (status, text) => {
    show(status);
    expect(screen.getAllByRole("status").some((el) => el.textContent === text)).toBe(true);
  });

  it("says nothing before the first answer", () => {
    show("idle");
    expect(screen.queryByText("Saved to server")).toBeNull();
    expect(screen.queryByText("Saved on this device")).toBeNull();
  });
});
