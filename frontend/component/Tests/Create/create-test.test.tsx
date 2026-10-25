import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp, renderWithIntl } from "@/i18n/test-utils";
import { fromZonedParts, toZonedParts } from "@/i18n/zonedTime";
import { hydrateFromExam, setCurrentStep, setFormField, setPublishTiming, setSingleSubject } from "@/lib/features/createTestSlice";
import { getQuestionValidationErrors } from "@/utils/createTestValidation";
import CreateTestFooter from "./CreateTestFooter";
import CreateTestStepSidebar from "./CreateTestStepSidebar";
import PublishSchedule from "./PublishSchedule";
import ReorderStep from "./ReorderStep";
import useCreateTestFlow from "./useCreateTestFlow";
import useQuestionTypeText from "./useQuestionTypeText";
import { makeStore } from "@/lib/store";
import { useAppSelector } from "@/lib/hooks";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/tests/create" }));
vi.mock("@/hooks/api/tests/useCreateTest", () => ({ default: () => [vi.fn(), { loading: false }] }));
vi.mock("@/hooks/api/tests/useUpdateTest", () => ({ default: () => [vi.fn(), { loading: false }] }));
vi.mock("@/hooks/organization/useWorkspace", () => ({ default: () => ({ isIndividual: true }) }));

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe("wizard steps", () => {
  it("lists the steps in the page language and jumps to one", () => {
    const store = makeStore();
    renderApp(<CreateTestStepSidebar currentStep="Basic info" />, { store, locale: "bn" });
    const nav = screen.getAllByRole("navigation", { name: "অগ্রগতি" }).at(-1)!;
    fireEvent.click(within(nav).getByRole("button", { name: /পর্যালোচনা/ }));
    expect((store.getState().createTest as CreateTestState).currentStep).toBe("Review");
  });

  it("offers Next, then Publish on the last step, and no Back on the first", () => {
    const { rerender } = renderApp(<CreateTestFooter currentStep="Basic info" isFirstStep isSubmitting={false} onBack={vi.fn()} onNext={vi.fn()} />);
    expect((screen.getByRole("button", { name: "Back" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Next" })).toBeTruthy();
    rerender(<CreateTestFooter currentStep="Publish" isFirstStep={false} isSubmitting={false} onBack={vi.fn()} onNext={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Publish test" })).toBeTruthy();
  });
});

describe("step checks", () => {
  const Next = () => {
    const state = useAppSelector((root) => root.createTest) as CreateTestState;
    const { handleNextStep } = useCreateTestFlow(state);
    return (
      <>
        <button onClick={() => void handleNextStep()}>go</button>
        <output>{state.currentStep}</output>
      </>
    );
  };

  it("stops on Basic info until the test has a name, and says why in the page language", async () => {
    const store = makeStore();
    renderApp(<Next />, { store, locale: "bn" });
    fireEvent.click(screen.getByRole("button", { name: "go" }));
    expect(await screen.findByText("পরীক্ষার নাম লিখুন।")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("Basic info");
  });

  it("moves on once the basics are filled in", async () => {
    const store = makeStore();
    store.dispatch(setFormField({ field: "testName", value: "Algebra quiz" }));
    store.dispatch(setFormField({ field: "duration", value: "45" }));
    store.dispatch(setSingleSubject({ id: "s1", label: "Math", value: "math" }));
    renderApp(<Next />, { store });
    fireEvent.click(screen.getByRole("button", { name: "go" }));
    await waitFor(() => expect(screen.getAllByRole("status").at(-1)?.textContent).toBe("Questions"));
  });
});

describe("schedule", () => {
  it("stores the time chosen in Dhaka time as UTC", () => {
    const store = makeStore();
    store.dispatch(setCurrentStep("Publish"));
    store.dispatch(setPublishTiming("later"));
    renderApp(<PublishSchedule />, { store });
    fireEvent.change(screen.getAllByLabelText("Date")[0], { target: { value: "2026-11-01" } });
    fireEvent.change(screen.getAllByLabelText("Time")[0], { target: { value: "10:30" } });
    expect((store.getState().createTest as CreateTestState).publishState.scheduleAt).toBe("2026-11-01T04:30:00.000Z");
  });

  it("converts between UTC and the organisation's clock", () => {
    expect(toZonedParts("2026-10-25T20:15:00.000Z")).toEqual({ date: "2026-10-26", time: "02:15" });
    expect(fromZonedParts("2026-10-26", "02:15")).toBe("2026-10-25T20:15:00.000Z");
    expect(fromZonedParts("", "10:00")).toBe("");
    expect(toZonedParts(null)).toEqual({ date: "", time: "" });
  });
});

describe("order", () => {
  it("moves a question with the keyboard buttons, not only by dragging", () => {
    const store = makeStore();
    store.dispatch(
      hydrateFromExam({
        id: "e1",
        subjects: [
          {
            id: "s1",
            name: "Math",
            questions: [
              { id: "q1", type: "graded", subType: "essay", text: "<p>First</p>", points: 1, sortOrder: 1 },
              { id: "q2", type: "graded", subType: "essay", text: "<p>Second</p>", points: 2, sortOrder: 2 },
            ],
          },
        ],
        formState: {},
        publishState: {},
      } as unknown as TeacherExamDetails),
    );
    renderApp(<ReorderStep />, { store });

    expect((screen.getByRole("button", { name: "Move question 1 up" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Move question 1 down" }));
    expect((store.getState().createTest as CreateTestState).questionOrder).toEqual(["q2", "q1"]);
  });
});

describe("question type text", () => {
  const Probe = () => {
    const text = useQuestionTypeText();
    return (
      <p>
        {[
          text.category("ungraded"),
          text.type("graded", "multiple-choice"),
          text.type("graded", "unknown-type", "Fallback label"),
          text.prompt("Write your question here (Use ______ for blank spot)"),
          text.issue({ key: "optionCount", values: { min: 2, max: 6 } }),
        ].join(" | ")}
      </p>
    );
  };

  it("translates categories, types, prompts and issues, falling back to English labels", () => {
    renderWithIntl(<Probe />, "bn");
    expect(screen.getByText("নম্বরবিহীন | বহুনির্বাচনি | Fallback label | এখানে প্রশ্ন লিখুন (শূন্যস্থানের জন্য ______ দিন) | ২ থেকে ৬টি বিকল্প দিন।")).toBeTruthy();
  });

  it("reports question problems as message keys", () => {
    const question = { id: "q1", type: "graded", subType: "multiple-choice", text: "", image: null, points: 0, options: [], answer: { type: "optionId", value: [] } } as unknown as QuestionItem;
    const keys = getQuestionValidationErrors(question).map((issue) => issue.key);
    expect(keys).toContain("titleOrImageMissing");
    expect(keys).toContain("pointsPositive");
    expect(keys).toContain("pickOneCorrect");
  });
});
