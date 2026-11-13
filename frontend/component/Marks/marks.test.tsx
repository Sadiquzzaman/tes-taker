import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/i18n/test-utils";
import { marksColumns, marksCsv, marksFromCsv } from "@/utils/marks/marksCsv";
import sidebarList from "@/utils/sidebarList";
import MarksGrid from "./MarksGrid";
import MarksPage from "./MarksPage";

const get = vi.fn();
const post = vi.fn();
const patch = vi.fn();
const put = vi.fn();
const del = vi.fn();
const push = vi.fn();
let memberRole: string | undefined = "TEACHER";
vi.mock("@/lib/authSession", () => ({ getStoredUser: () => ({ id: "me", role: memberRole === "STUDENT" ? "STUDENT" : "TEACHER", access_token: "token" }), clearAuthSession: vi.fn() }));
vi.mock("@/hooks/organization/useWorkspace", () => ({ default: () => ({ memberRole }) }));
vi.mock("@/lib/axios", () => ({
  default: {
    get: (...args: unknown[]) => get(...args),
    post: (...args: unknown[]) => post(...args),
    patch: (...args: unknown[]) => patch(...args),
    put: (...args: unknown[]) => put(...args),
    delete: (...args: unknown[]) => del(...args),
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => "/marks" }));

const ok = <T,>(payload: T) => Promise.resolve({ data: { payload } });

const exam = (extra: Partial<PaperExam> = {}): PaperExam => ({
  id: "x1",
  name: "Half-yearly exam",
  exam_date: "2026-12-10",
  total_marks: 100,
  parts: [
    { name: "MCQ", marks: 30 },
    { name: "Written", marks: 70 },
  ],
  session_id: "s1",
  term: null,
  offering: { id: "o1", subject: { id: "math", name: "Math" }, section: { id: "sa", name: "A", class_name: "Class 6" } },
  published_at: null,
  counts: { students: 2, entered: 1 },
  can_edit: true,
  ...extra,
});
const row = (id: string, name: string, roll: string, extra: Partial<PaperMarkRow> = {}): PaperMarkRow => ({
  student: { id, full_name: name, roll_no: roll },
  marks: null,
  part_marks: null,
  is_absent: false,
  percent: null,
  grade: null,
  ...extra,
});
const grid = (examExtra: Partial<PaperExam> = {}): PaperMarksGrid => ({
  exam: exam(examExtra),
  rows: [row("st1", "Mitu Das", "1", { marks: 80.5, part_marks: { MCQ: 24.5, Written: 56 }, percent: 80.5, grade: { grade: "A+", gpa: 5 } }), row("st2", "Rafi Ahmed", "2")],
});
const subjectClasses: PaperSubjectClass[] = [
  { offering_id: "o1", session_id: "s1", section_label: "Class 6 A", subject: { id: "math", name: "Math" }, terms: [{ id: "t1", name: "Half-yearly", start_date: null, end_date: null }] },
];

beforeEach(() => {
  memberRole = "TEACHER";
  for (const mock of [get, post, patch, put, del, push]) mock.mockReset();
});
afterEach(() => cleanup());

describe("paper exams list (PRF-03)", () => {
  it("lists the exams with marks entered, and adds one with parts adding up to the total", async () => {
    get.mockImplementation((url: string) =>
      url.endsWith("/offline-exams") ? ok([exam()]) : url.endsWith("/subject-classes") ? ok(subjectClasses) : Promise.reject(new Error(`unexpected GET ${url}`)),
    );
    post.mockReturnValue(ok(exam({ id: "x2", name: "Class test" })));
    renderApp(<MarksPage />);
    const table = within(await screen.findByRole("table", { name: "Paper exams" }));
    expect(table.getByRole("link", { name: "Half-yearly exam" }).getAttribute("href")).toBe("/marks/x1");
    expect(table.getByText("1 of 2")).toBeTruthy();
    expect(table.getByText("Not published")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Add paper exam" }));
    const drawer = within(await screen.findByRole("dialog", { name: "Add a paper exam" }));
    fireEvent.click(drawer.getByRole("button", { name: "Save" }));
    expect(await drawer.findByText("Choose the subject and section.")).toBeTruthy();
    fireEvent.change(await drawer.findByLabelText("Subject and section"), { target: { value: "o1" } });
    fireEvent.change(drawer.getByLabelText("Exam name"), { target: { value: " Class test " } });
    fireEvent.change(drawer.getByLabelText("Total marks"), { target: { value: "50" } });
    fireEvent.change(drawer.getByLabelText("Term (optional)"), { target: { value: "t1" } });
    fireEvent.click(drawer.getByLabelText(/Split into parts/));
    fireEvent.change(drawer.getByLabelText("Marks of part 1"), { target: { value: "20" } });
    fireEvent.change(drawer.getByLabelText("Marks of part 2"), { target: { value: "30" } });
    expect(drawer.getByText("Parts add up to 50 of 50.")).toBeTruthy();
    fireEvent.click(drawer.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post.mock.calls[0][0]).toMatch(/\/offline-exams$/);
    expect(post.mock.calls[0][1]).toMatchObject({
      offering_id: "o1",
      name: "Class test",
      total_marks: 50,
      term_id: "t1",
      parts: [
        { name: "MCQ", marks: 20 },
        { name: "Written", marks: 30 },
      ],
    });
    expect(await screen.findByText("Paper exam added")).toBeTruthy();
  });

  it("shows students their published results, in Bangla too", async () => {
    memberRole = "STUDENT";
    get.mockImplementation(() =>
      ok([{ exam: { id: "x1", name: "Half-yearly exam", exam_date: "2026-12-10", total_marks: 100, parts: null, term: null, subject: { id: "math", name: "Math" } }, marks: 72.5, part_marks: null, is_absent: false, percent: 72.5, grade: { grade: "A", gpa: 4 } }]),
    );
    renderApp(<MarksPage />);
    expect(await screen.findByText("72.5/100 · 72.5% (A)")).toBeTruthy();
    expect(get).toHaveBeenCalledWith(expect.stringMatching(/\/offline-exams\/mine$/), expect.anything());
    cleanup();
    renderApp(<MarksPage />, { locale: "bn" });
    expect(await screen.findByRole("heading", { name: "লিখিত পরীক্ষার ফলাফল" })).toBeTruthy();
  });
});

describe("marks grid (PRF-03)", () => {
  it("saves only the changed students, per part and absent, and explains a refused line", async () => {
    get.mockImplementation((url: string) => (url.endsWith("/marks") ? ok(grid()) : ok(subjectClasses)));
    put.mockRejectedValueOnce({ response: { status: 400, data: { code: "OFFLINE_EXAM_MARKS_INVALID", details: { index: 0 } } } }).mockReturnValueOnce(ok(grid()));
    renderApp(<MarksGrid id="x1" />);
    const table = within(await screen.findByRole("table", { name: "Marks for Half-yearly exam" }));
    expect(table.getByText("80.5 · 80.5% (A+)")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save marks" }).hasAttribute("disabled")).toBe(true);
    fireEvent.change(table.getByLabelText("MCQ for Rafi Ahmed"), { target: { value: "40" } });
    fireEvent.change(table.getByLabelText("Written for Rafi Ahmed"), { target: { value: "50" } });
    expect(screen.getByText("1 change not saved")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save marks" }));
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(put.mock.calls[0][1]).toEqual({ rows: [{ student_id: "st2", part_marks: { MCQ: 40, Written: 50 }, is_absent: false }] });
    expect(await screen.findByText(/^Rafi Ahmed: Marks must be between 0 and the total/)).toBeTruthy();

    fireEvent.click(table.getByLabelText("Rafi Ahmed was absent"));
    expect((table.getByLabelText("MCQ for Rafi Ahmed") as HTMLInputElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Save marks" }));
    await waitFor(() => expect(put).toHaveBeenCalledTimes(2));
    expect(put.mock.calls[1][1]).toEqual({ rows: [{ student_id: "st2", is_absent: true }] });
    expect(await screen.findByText("Marks saved")).toBeTruthy();
  });

  it("publishes after asking, and is read-only when the session is closed", async () => {
    get.mockImplementation((url: string) => (url.endsWith("/marks") ? ok(grid()) : ok(subjectClasses)));
    post.mockReturnValue(ok(exam({ published_at: "2026-12-11T00:00:00Z" })));
    renderApp(<MarksGrid id="x1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Publish marks" }));
    const confirm = within(await screen.findByRole("dialog", { name: "Publish these marks?" }));
    expect(confirm.getByText("Students will see their marks. 1 student has no marks yet.")).toBeTruthy();
    fireEvent.click(confirm.getByRole("button", { name: "Publish marks" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith(expect.stringMatching(/\/offline-exams\/x1\/publish$/)));

    cleanup();
    get.mockImplementation((url: string) => (url.endsWith("/marks") ? ok(grid({ can_edit: false, published_at: "2026-12-11T00:00:00Z" })) : ok(subjectClasses)));
    renderApp(<MarksGrid id="x1" />);
    expect(await screen.findByText("You can see these marks but not change them.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Save marks" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Publish marks" })).toBeNull();
    expect(screen.getByRole("button", { name: "Download marks sheet" })).toBeTruthy();
  });
});

describe("marks sheet", () => {
  it("has a column per part (or marks) and reads it back by roll or name, Bangla digits and absent", () => {
    const g = grid();
    expect(marksColumns(g.exam)).toEqual(["roll_no", "name", "MCQ", "Written", "absent"]);
    expect(marksColumns({ parts: null })).toEqual(["roll_no", "name", "marks", "absent"]);
    expect(marksCsv(g).split("\n")[1]).toBe("1,Mitu Das,24.5,56,");
    const sheet = ["roll_no,name,MCQ,Written,absent", "১,Mitu Das,২৫,৬০,", ",rafi ahmed,,,absent", "9,Nobody,1,1,", ""].join("\n");
    const read = marksFromCsv(sheet, g);
    expect(read.rows).toEqual([
      { student_id: "st1", part_marks: { MCQ: 25, Written: 60 }, is_absent: false },
      { student_id: "st2", is_absent: true },
    ]);
    expect(read.problems).toEqual([{ line: 4, reason: "STUDENT_UNKNOWN" }]);
    expect(marksFromCsv("student,score\nMitu,5", g).problems).toEqual([{ line: 1, reason: "COLUMNS_MISSING" }]);
  });
});

describe("menu", () => {
  it("puts Paper exams in Results for staff, solo teachers and students, behind the performance feature", () => {
    const items = sidebarList.filter((entry) => entry.route === "/marks");
    expect(items).toHaveLength(3);
    expect(items.every((entry) => entry.feature === "performance" && entry.group === "results")).toBe(true);
    expect(items.find((entry) => entry.category === "Organization")?.memberRoles).toEqual(["OWNER", "ADMIN", "ASSISTANT", "TEACHER"]);
  });
});
