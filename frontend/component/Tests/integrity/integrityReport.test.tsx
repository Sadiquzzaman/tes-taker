import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/i18n/test-utils";
import IntegrityReport from "./IntegrityReport";

const get = vi.fn();
const post = vi.fn();
vi.mock("@/lib/axios", () => ({ default: { get: (...args: unknown[]) => get(...args), post: (...args: unknown[]) => post(...args) } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/tests/x1/integrity" }));

const ok = <T,>(payload: T) => Promise.resolve({ data: { payload } });
const report: IntegrityReport = {
  exam_id: "x1",
  summary: { students: 2, flagged: 1, disqualified: 1, reviewed: 0 },
  by_check: [
    { check: "proctoring_phone", count: 2, students: 1 },
    { check: "proctoring_tab_switch", count: 1, students: 1 },
  ],
  students: [
    {
      student_id: "st1",
      student_name: "Mitu Das",
      status: "DISQUALIFIED",
      total_score: 4,
      max_score: 10,
      flags: 3,
      checks: [
        { check: "proctoring_phone", count: 2 },
        { check: "proctoring_tab_switch", count: 1 },
      ],
      disqualification_reason: "Ended by the teacher: Phone on the desk",
      last_review: null,
    },
    { student_id: "st2", student_name: "Rafi Ahmed", status: "SUBMITTED", total_score: 9, max_score: 10, flags: 0, checks: [], disqualification_reason: null, last_review: null },
  ],
};
const studentReport: StudentIntegrityReport = {
  attempt: { student_id: "st1", student_name: "Mitu Das", status: "DISQUALIFIED", started_at: null, submitted_at: null, total_score: 4, max_score: 10, disqualification_reason: "Ended by the teacher: Phone on the desk" },
  checks: [{ check: "proctoring_phone", count: 2 }],
  timeline: [
    { id: "e1", type: "phone-detected", check: "proctoring_phone", message: "Phone", points: 3, source: "LIVE", occurred_at: "2026-11-13T05:00:00Z" },
    { id: "e2", type: "teacher-ended", check: null, message: "Phone on the desk", points: 0, source: "SERVER", occurred_at: "2026-11-13T05:01:00Z" },
  ],
  reviews: [],
};

beforeEach(() => {
  localStorage.setItem("user", JSON.stringify({ id: "t1", access_token: "token" }));
  post.mockReset();
  get.mockImplementation((url: string) =>
    url.endsWith("/proctoring/integrity") ? ok(report) : url.endsWith("/report") ? ok(studentReport) : ok({ test_name: "Physics quiz" }),
  );
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("integrity report (PRO-04, PRO-05)", () => {
  it("shows the totals, flags by check and students most flagged first", async () => {
    renderApp(<IntegrityReport examId="x1" />);
    const checks = within(await screen.findByRole("list", { name: "Flags by check" }));
    expect(checks.getByText("Phone detection")).toBeTruthy();
    expect(checks.getByText("2 flags · 1 student")).toBeTruthy();
    const table = within(screen.getByRole("table", { name: "Students who took the test, most flagged first" }));
    const rows = table.getAllByRole("row").slice(1);
    expect(rows[0].textContent).toContain("Mitu Das");
    expect(rows[0].textContent).toContain("Disqualified");
    expect(rows[0].textContent).toContain("4 of 10");
    expect(rows[1].textContent).toContain("Rafi Ahmed");
  });

  it("opens a student's report and records a decision with a reason", async () => {
    post.mockReturnValue(ok({ status: "SUBMITTED" }));
    renderApp(<IntegrityReport examId="x1" />);
    // The table and its phone view each have the button.
    fireEvent.click((await screen.findAllByRole("button", { name: "Open the report for Mitu Das" }))[0]);
    const drawer = within(await screen.findByRole("dialog", { name: "Mitu Das" }));
    expect(await drawer.findByText("Phone seen")).toBeTruthy();
    expect(drawer.getByText("Exam ended by the teacher: Phone on the desk")).toBeTruthy();
    const save = drawer.getByRole("button", { name: "Save decision" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.click(drawer.getByLabelText(/Reinstate/));
    fireEvent.change(drawer.getByLabelText("Reason"), { target: { value: "It was a calculator." } });
    fireEvent.click(save);
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(expect.stringMatching(/\/exams\/x1\/proctoring\/students\/st1\/review$/), { decision: "REINSTATE", reason: "It was a calculator." }),
    );
  });

  it("offers no reinstate for an attempt that was not disqualified", async () => {
    renderApp(<IntegrityReport examId="x1" />);
    fireEvent.click((await screen.findAllByRole("button", { name: "Open the report for Rafi Ahmed" }))[0]);
    const drawer = within(await screen.findByRole("dialog", { name: "Rafi Ahmed" }));
    expect(await drawer.findByLabelText(/Confirm the result/)).toBeTruthy();
    expect(drawer.queryByLabelText(/Reinstate/)).toBeNull();
  });

  it("says when the teacher may not see the report", async () => {
    get.mockImplementation((url: string) => (url.endsWith("/proctoring/integrity") ? Promise.reject({ response: { status: 403 } }) : ok({ test_name: "Physics quiz" })));
    renderApp(<IntegrityReport examId="x1" />);
    expect(await screen.findByText("You can't see this test's integrity report.")).toBeTruthy();
  });
});
