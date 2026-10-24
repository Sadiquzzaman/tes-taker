import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TestCard from "@/component/Classes/TestCard";
import { renderApp } from "@/i18n/test-utils";
import { getTestCategory } from "@/utils/tests/testListItem";
import ExamDetails from "./ExamDetails";
import ShareTestModal from "./ShareTestModal";

const push = vi.fn();
const get = vi.fn();
const patch = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => "/tests" }));
vi.mock("@/lib/axios", () => ({ default: { get: (...args: unknown[]) => get(...args), patch: (...args: unknown[]) => patch(...args) } }));
vi.mock("@/lib/authSession", () => ({ getStoredUser: () => ({ id: "teacher-1" }) }));
vi.mock("@/hooks/api/exam/useDownloadExamQuestions", () => ({ default: () => ({ download: vi.fn(), loading: false }) }));

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

const studentTest = (status: "ongoing" | "pending" | "completed") =>
  ({
    id: "e1",
    test_name: "Algebra quiz",
    status,
    subject: "Math",
    class_name: "9A",
    participant_count: 30,
    submitted_count: 12,
    exam_start_time: "2026-10-26T04:30:00.000Z",
    exam_end_time: "2026-10-26T05:30:00.000Z",
    exam_category: "academic",
  }) as unknown as TestListItem;

describe("test card", () => {
  it("lets a student start a live test", () => {
    renderApp(<TestCard testData={studentTest("ongoing")} role="STUDENT" />);
    expect(screen.getByText("Live")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Start test" }));
    expect(sessionStorage.getItem("testId")).toBe("e1");
    expect(push).toHaveBeenCalledWith("/test/permissions");
  });

  it("calls a not-yet-started test Scheduled, and links completed ones to results", () => {
    renderApp(<TestCard testData={studentTest("pending")} role="STUDENT" />);
    expect(screen.getByText("Scheduled")).toBeTruthy();
    cleanup();
    renderApp(<TestCard testData={studentTest("completed")} role="STUDENT" />);
    expect(screen.getByRole("link", { name: "View results" }).getAttribute("href")).toBe("/tests/e1/results");
  });

  it("shows submission progress, in Bangla too", () => {
    renderApp(<TestCard testData={studentTest("ongoing")} role="STUDENT" />, { locale: "bn" });
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("40");
    expect(screen.getByText("৩০জনের মধ্যে ১২")).toBeTruthy();
    expect(screen.getByText("একাডেমিক")).toBeTruthy();
  });
});

describe("share test", () => {
  it("says who can take a class test and how many are excluded", async () => {
    const test = {
      id: "e1",
      test_name: "Algebra quiz",
      publish_timing: "immediately",
      exam_start_time: null,
      test_audience: "selected_class",
      class_name: "9A",
      excluded_students: ["a", "b"],
    } as unknown as TeacherShareableTest;
    renderApp(<ShareTestModal open setOpen={vi.fn()} testData={{ type: "new", test }} />);
    const dialog = await screen.findByRole("dialog", { name: "Test created" });
    expect(within(dialog).getByText("Only students of 9A can take it.")).toBeTruthy();
    expect(within(dialog).getByText("2 students are excluded.")).toBeTruthy();
    expect(within(dialog).getByText(/\/join\/test\/e1/)).toBeTruthy();
  });
});

describe("test details", () => {
  const exam = {
    id: "e1",
    test_name: "Algebra quiz",
    status: "pending",
    is_active: 1,
    created_by: "teacher-1",
    class_name: "9A",
    subjects: [{ id: "s1", name: "Math", questions: [{ id: "q1", points: 2 }, { id: "q2", points: 3 }] }],
    formState: { duration: 45, passingScore: 2, allowNegativeMarking: false },
    publishState: { testAudience: "selected_class", scheduleAt: "2099-01-01T04:00:00.000Z", endingAt: "2099-01-01T05:00:00.000Z" },
  };

  it("asks before disabling a test that has not started", async () => {
    get.mockResolvedValue({ data: { payload: exam } });
    patch.mockResolvedValue({ data: {} });
    renderApp(<ExamDetails examId="e1" />);

    expect(await screen.findByRole("heading", { name: "Algebra quiz" })).toBeTruthy();
    expect(screen.getByText("45 minutes")).toBeTruthy();
    expect(screen.getByText("A class")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Disable" }));
    expect(patch).not.toHaveBeenCalled();
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Disable" }));
    await waitFor(() => expect(patch).toHaveBeenCalledWith(expect.stringContaining("/exams/e1/status"), { active: false }));
  });

  it("explains that a started test is locked", async () => {
    get.mockResolvedValue({ data: { payload: { ...exam, status: "ongoing", publishState: { ...exam.publishState, scheduleAt: "2020-01-01T00:00:00Z" } } } });
    renderApp(<ExamDetails examId="e1" />);
    expect(await screen.findByText("The test has started or ended, so it can no longer be edited or disabled.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Disable" })).toBeNull();
  });
});

describe("test helpers", () => {
  it("reads the category from the list item or its form state", () => {
    expect(getTestCategory({ exam_category: "ielts" } as TestListItem)).toBe("ielts");
    expect(getTestCategory({ status: "pending" } as TestListItem)).toBeNull();
  });
});
