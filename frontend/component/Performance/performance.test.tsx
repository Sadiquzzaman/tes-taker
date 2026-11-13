import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/i18n/test-utils";
import sidebarList from "@/utils/sidebarList";
import PerformancePage from "./PerformancePage";
import StudentPerformanceView from "./StudentPerformanceView";

const get = vi.fn();
let memberRole: string | undefined = "TEACHER";
vi.mock("@/lib/authSession", () => ({ getStoredUser: () => ({ id: memberRole === "STUDENT" ? "st1" : "me", role: memberRole === "STUDENT" ? "STUDENT" : "TEACHER", access_token: "token" }), clearAuthSession: vi.fn() }));
vi.mock("@/hooks/organization/useWorkspace", () => ({ default: () => ({ memberRole }) }));
vi.mock("@/lib/axios", () => ({ default: { get: (...args: unknown[]) => get(...args) } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/performance" }));

const ok = <T,>(payload: T) => Promise.resolve({ data: { payload } });
/** A stat tile's text, found by its label. */
const tile = (label: string) => screen.getByText(label).parentElement?.parentElement?.textContent;
const line = (score: number | null, extra: Partial<ScoreLine> = {}): ScoreLine => ({
  exams_pct: score,
  homework_pct: 100,
  attendance_pct: 95,
  behaviour_pct: 90,
  score_pct: score,
  grade: score === null ? null : score >= 80 ? { grade: "A+", gpa: 5 } : { grade: "C", gpa: 2 },
  counts: { exams: 3, homework: 1, ratings: 2 },
  ...extra,
});
const row = (id: string, name: string, score: number, position: number, extra: Partial<StudentScoreRow> = {}): StudentScoreRow => ({
  student: { id, full_name: name, roll_no: id === "st1" ? "1" : "2" },
  overall: line(score),
  subjects: [
    { subject: { id: "math", name: "Math" }, ...line(score + 2) },
    { subject: { id: "eng", name: "English" }, ...line(score - 10) },
  ],
  homework: { set: 2, missing: 0, late: 0 },
  missing_homework: 0,
  at_risk: [],
  position,
  ...extra,
});
const section: SectionScores = {
  section: { id: "sa", name: "A", class_id: "c6", class_name: "Class 6", session_id: "s1" },
  period: { from: "2026-01-01", to: "2026-06-30", term: { id: "t1", name: "Half-yearly" } },
  weights: { exams_pct: 50, homework_pct: 20, attendance_pct: 20, behaviour_pct: 10, is_default: true },
  thresholds: { score_pct: 40, attendance_pct: 75, missing_homework: 3 },
  subjects: [
    { id: "eng", name: "English" },
    { id: "math", name: "Math" },
  ],
  exams: [
    { id: "x1", kind: "PAPER", name: "Math half-yearly", date: "2026-03-01", subject_id: "math", average_pct: 80, taken: 2 },
    { id: "x2", kind: "ONLINE", name: "English quiz", date: "2026-03-02", subject_id: "eng", average_pct: 60, taken: 2 },
  ],
  students: [
    row("st1", "Mitu Das", 88, 1),
    row("st2", "Rafi Ahmed", 43, 2, { at_risk: ["ATTENDANCE", "MISSING_HOMEWORK"], missing_homework: 3, homework: { set: 2, missing: 2, late: 0 }, overall: line(43, { attendance_pct: 70 }) }),
  ],
};
const performance = (extra: Partial<StudentPerformance> = {}): StudentPerformance => ({
  student: { id: "st1", full_name: "Mitu Das", roll_no: "1" },
  section: { id: "sa", name: "A", class_name: "Class 6", session: { id: "s1", name: "2026", closed: false } },
  sections: [
    { id: "sa", name: "A", class_name: "Class 6", session: { id: "s1", name: "2026" } },
    { id: "s5", name: "A", class_name: "Class 5", session: { id: "s0", name: "2025" } },
  ],
  terms: [{ id: "t1", name: "Half-yearly" }],
  period: { from: "2026-01-01", to: "2026-12-31", term: null },
  weights: section.weights,
  overall: line(88),
  subjects: section.students[0].subjects,
  position: 1,
  class_size: 2,
  at_risk: [],
  attendance: { counts: { present: 19, late: 0, absent: 1, leave: 0 }, attendance_pct: 95 },
  homework: { set: 1, missing: 0, late: 0, on_time_pct: 100 },
  exams: [
    { id: "x1", kind: "PAPER", name: "Math half-yearly", date: "2026-03-01", subject: { id: "math", name: "Math" }, marks: 80, total: 100, percent: 80, is_absent: false },
    { id: "x3", kind: "PAPER", name: "Science test", date: "2026-03-05", subject: null, marks: null, total: 50, percent: null, is_absent: true },
  ],
  homework_items: [{ id: "h1", title: "Fractions", subject: { id: "math", name: "Math" }, due_date: "2026-03-03", percent: 90, is_missing: false, is_late: true }],
  trend: [
    { term: { id: "t1", name: "Half-yearly" }, score_pct: 88 },
    { term: { id: "t2", name: "Final" }, score_pct: null },
  ],
  strengths: [section.students[0].subjects[0]],
  weaknesses: [],
  published_only: false,
  ...extra,
});

beforeEach(() => {
  memberRole = "TEACHER";
  get.mockReset();
});
afterEach(() => cleanup());

describe("class dashboard (PRF-07)", () => {
  it("shows the section's average, highest and lowest, who is at risk, and every student's position", async () => {
    get.mockImplementation((url: string) =>
      url.endsWith("/scores/sections")
        ? ok({ session: { id: "s1", name: "2026", closed: false }, terms: [{ id: "t1", name: "Half-yearly" }], sections: [{ id: "sa", name: "A", class_name: "Class 6" }] })
        : url.endsWith("/scores/sections/sa")
          ? ok(section)
          : url.endsWith("/sessions")
            ? ok([])
            : Promise.reject(new Error(url)),
    );
    renderApp(<PerformancePage />);
    const table = within(await screen.findByRole("table", { name: "Scores in Class 6 A" }));
    expect(tile("Average")).toContain("65.5%");
    expect(tile("Highest")).toContain("88%");
    expect(tile("Homework handed in")).toContain("50%");
    expect(table.getByRole("link", { name: "1. Mitu Das" }).getAttribute("href")).toBe("/performance/students/st1?section_id=sa");
    expect(screen.getByText("Attendance 70%")).toBeTruthy();
    expect(screen.getByText("3 missing homework")).toBeTruthy();
    expect(screen.getByText("Score = exams 50% · homework 20% · attendance 20% · behaviour 10%")).toBeTruthy();

    // One subject: its scores and its exams only.
    fireEvent.change(screen.getByLabelText("Subject"), { target: { value: "eng" } });
    expect(tile("Highest")).toContain("78%");
    expect(screen.getByRole("figure", { name: "Class average per exam: English quiz 60%" })).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Term"), { target: { value: "t1" } });
    await waitFor(() => expect(get).toHaveBeenCalledWith(expect.stringMatching(/\/scores\/sections\/sa$/), { params: { term_id: "t1" } }));
  });
});

describe("whole school (PRF-08)", () => {
  it("shows owners every section and subject, and opens a section", async () => {
    memberRole = "OWNER";
    const overview: SchoolOverview = {
      session: { id: "s1", name: "2026", closed: false },
      term: null,
      terms: [],
      sections: [
        { section: { id: "sa", name: "A", class_name: "Class 6" }, students: 30, average_pct: 72.5, highest_pct: 95, lowest_pct: 31, attendance_pct: 91, homework_rate_pct: 88, at_risk: 3 },
        { section: { id: "sb", name: "B", class_name: "Class 6" }, students: 28, average_pct: 68, highest_pct: 90, lowest_pct: 40, attendance_pct: 89, homework_rate_pct: 80, at_risk: 1 },
      ],
      subjects: [{ subject: { id: "math", name: "Math" }, average_pct: 61.75, sections: 2 }],
    };
    get.mockImplementation((url: string) =>
      url.endsWith("/scores/sections")
        ? ok({ session: { id: "s1", name: "2026", closed: false }, terms: [], sections: [{ id: "sa", name: "A", class_name: "Class 6" }, { id: "sb", name: "B", class_name: "Class 6" }] })
        : url.endsWith("/scores/overview")
          ? ok(overview)
          : url.endsWith("/scores/sections/sb")
            ? ok({ ...section, section: { ...section.section, id: "sb", name: "B" } })
            : ok([]),
    );
    renderApp(<PerformancePage />);
    const bySection = within(await screen.findByRole("table", { name: "By section" }));
    expect(bySection.getByText("72.5%")).toBeTruthy();
    expect(within(screen.getByRole("table", { name: "By subject" })).getByText("61.75%")).toBeTruthy();
    expect(screen.queryByLabelText("Section")).toBeNull();
    fireEvent.click(bySection.getByRole("button", { name: "Open Class 6 B" }));
    expect(await screen.findByRole("table", { name: "Scores in Class 6 B" })).toBeTruthy();
    expect((screen.getByLabelText("Section") as HTMLSelectElement).value).toBe("sb");
  });
});

describe("student performance page (PRF-05, PRF-06)", () => {
  it("shows the score, subjects, every exam and homework, strengths and earlier sessions", async () => {
    get.mockImplementation((url: string, config?: { params?: Record<string, string> }) => ok(performance(config?.params?.section_id === "s5" ? { section: { id: "s5", name: "A", class_name: "Class 5", session: { id: "s0", name: "2025", closed: true } } } : {})));
    renderApp(<StudentPerformanceView studentId="st1" initialSectionId="sa" />);
    expect(await screen.findByRole("heading", { name: "Mitu Das" })).toBeTruthy();
    expect(tile("Overall")).toContain("88% · A+");
    expect(tile("Position")).toContain("1 of 2");
    const exams = within(screen.getByRole("table", { name: "Exams" }));
    // The card's title is not repeated as the first column; GPA has two decimals.
    expect(exams.getByRole("columnheader", { name: /^Name/ })).toBeTruthy();
    expect(screen.getByText("GPA").parentElement?.parentElement?.textContent).toContain("5.00");
    expect(exams.getByText("80/100 · 80%")).toBeTruthy();
    expect(exams.getByText("Absent")).toBeTruthy();
    const homework = within(screen.getByRole("table", { name: "Homework" }));
    expect(homework.getByText("Late")).toBeTruthy();
    expect(screen.getByText("Math 90%")).toBeTruthy();
    expect(screen.getByText("Half-yearly: 88%")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Session"), { target: { value: "s5" } });
    await waitFor(() => expect(get).toHaveBeenLastCalledWith(expect.stringMatching(/\/scores\/students\/st1$/), { params: { section_id: "s5" } }));
  });

  it("shows a student their own page with published results only, in Bangla too", async () => {
    memberRole = "STUDENT";
    get.mockImplementation(() => ok(performance({ published_only: true, position: null })));
    renderApp(<PerformancePage />);
    expect(await screen.findByRole("heading", { name: "My performance" })).toBeTruthy();
    expect(get).toHaveBeenCalledWith(expect.stringMatching(/\/scores\/students\/st1$/), expect.anything());
    expect(screen.getByText("You see the results your teachers have published.")).toBeTruthy();
    expect(tile("Position")).toContain("—");
    cleanup();
    renderApp(<PerformancePage />, { locale: "bn" });
    expect(await screen.findByRole("heading", { name: "আমার পারফরম্যান্স" })).toBeTruthy();
  });
});

describe("menu", () => {
  it("puts Performance first in Results for staff, solo teachers and students", () => {
    const items = sidebarList.filter((entry) => entry.route === "/performance");
    expect(items).toHaveLength(3);
    expect(items.every((entry) => entry.feature === "performance" && entry.group === "results")).toBe(true);
  });
});
