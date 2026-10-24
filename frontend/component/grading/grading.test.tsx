import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/i18n/test-utils";
import { setGradeDetailsData } from "@/lib/features/gradeDetailsSlice";
import { makeStore } from "@/lib/store";
import getSubmissionGradeValidationError from "@/utils/grading/getSubmissionGradeValidationError";
import ExamClassRosterPanel from "./ExamClassRosterPanel";
import GradeCard from "./GradeCard";
import GradeDetailsHeader from "./GradeDetailsHeader";
import StudentSubmissionsTable from "./StudentSubmissionsTable";

const get = vi.fn();
const post = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/grading" }));
vi.mock("@/lib/axios", () => ({
  default: { get: (...args: unknown[]) => get(...args), post: (...args: unknown[]) => post(...args) },
}));

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

const exam = (grading_status: GradingStatus) =>
  ({ id: "e1", test_name: "Algebra quiz", grading_status, is_result_published: grading_status === "PUBLISHED" }) as GradingExamSummary;
const stats = (pending: number) =>
  ({ total_students: 3, submissions: 2, not_submitted: 1, graded: 2 - pending, pending, average_percentage: null }) as GradingExamStats;
const submission = (id: string, graded: boolean) =>
  ({
    submission_id: id,
    student_id: `s-${id}`,
    student_name: graded ? "Rina" : null,
    email: null,
    phone: null,
    submitted_at: "2026-10-25T04:30:00.000Z",
    status: "SUBMITTED",
    total_score: graded ? 8 : null,
    max_score: 10,
    percentage: null,
    is_graded: graded,
    grading_status: graded ? "GRADED" : "PENDING",
    proctoring_summary: { total_violations: 1, total_red_flag_points: 2, counts_by_type: {} },
  }) as GradingSubmissionListItem;

const storeWith = (status: GradingStatus, pending: number, submissions: GradingSubmissionListItem[] = []) => {
  const store = makeStore();
  store.dispatch(
    setGradeDetailsData({ exam: exam(status), stats: stats(pending), submissions, meta: { page: 1, total_pages: 1 } as GradingPaginationMeta }),
  );
  return store;
};

describe("grade card", () => {
  it("shows the grading status and progress, in Bangla too", () => {
    const item = {
      id: "e1",
      test_name: "Algebra quiz",
      grading_status: "NEEDS_GRADING",
      submitted_count: 12,
      total_participants: 30,
      graded_count: 4,
    } as GradingListItem;
    renderApp(<GradeCard gradeItem={item} />, { locale: "bn" });
    expect(screen.getByText("মূল্যায়ন বাকি")).toBeTruthy();
    expect(screen.getByText("১২ / ৩০")).toBeTruthy();
  });
});

describe("grade details header", () => {
  it("only allows publishing when every submission is graded", () => {
    renderApp(<GradeDetailsHeader refetchGradeDetails={vi.fn()} />, { store: storeWith("NEEDS_GRADING", 1) });
    expect((screen.getByRole("button", { name: "Publish results" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("asks before publishing, then publishes", async () => {
    post.mockResolvedValue({ status: 201, data: { message: "ok", payload: {} } });
    const refetch = vi.fn().mockResolvedValue(undefined);
    renderApp(<GradeDetailsHeader refetchGradeDetails={refetch} />, { store: storeWith("GRADED", 0) });
    fireEvent.click(screen.getByRole("button", { name: "Publish results" }));
    const dialog = await screen.findByRole("dialog", { name: "Publish results?" });
    expect(post).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Publish results" }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(refetch).toHaveBeenCalled());
  });
});

describe("submissions table", () => {
  it("opens grading for an ungraded submission and the result for a graded one", () => {
    const store = storeWith("NEEDS_GRADING", 1, [submission("a", false), submission("b", true)]);
    renderApp(<StudentSubmissionsTable />, { store });
    const table = screen.getAllByRole("table")[0];
    expect(within(table).getAllByText("Submitted").length).toBeGreaterThan(0);
    fireEvent.click(within(table).getByRole("button", { name: "Grade" }));
    expect(store.getState().gradeDetails.openModal).toBe("edit");
    fireEvent.click(within(table).getByRole("button", { name: "View" }));
    expect(store.getState().gradeDetails.openModal).toBe("result");
    expect(store.getState().gradeDetails.selectedSubmission?.submission_id).toBe("b");
  });
});

describe("class progress", () => {
  it("shows counts and a student's proctoring details", async () => {
    get.mockResolvedValue({
      data: {
        payload: {
          exam: { id: "e1", test_name: "Algebra quiz", class_name: "9A" },
          counts: { not_started: 1, in_progress: 0, submitted: 2, auto_submitted: 0, disqualified: 0 },
          students: [
            {
              ...submission("a", true),
              duration_seconds: 600,
              browser_switch_count: 1,
              tab_switch_count: 3,
              disqualification_reason: null,
              proctoring_events: [{ id: "p1", type: "TAB_SWITCH", message: "Left the test tab", timestamp: "2026-10-25T04:40:00.000Z" }],
            },
          ],
        },
      },
    });
    renderApp(<ExamClassRosterPanel examId="e1" />);
    fireEvent.click(await screen.findAllByRole("button", { name: "Proctoring details" }).then((buttons) => buttons[0]));
    const dialog = await screen.findByRole("dialog", { name: "Proctoring for Rina" });
    expect(within(dialog).getByText("Left the test tab")).toBeTruthy();
  });

  it("offers a retry when the class list fails to load", async () => {
    get.mockRejectedValueOnce(new Error("offline"));
    renderApp(<ExamClassRosterPanel examId="e1" />);
    expect(await screen.findByText("The class list for this test did not load.")).toBeTruthy();
  });
});

describe("mark validation", () => {
  it("rejects marks below zero or above the question's points", () => {
    expect(getSubmissionGradeValidationError(-1, 5)).toBe("belowZero");
    expect(getSubmissionGradeValidationError(6, 5)).toBe("aboveMax");
    expect(getSubmissionGradeValidationError(5, 5)).toBe("");
  });
});
