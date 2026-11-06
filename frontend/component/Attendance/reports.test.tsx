import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/i18n/test-utils";
import sidebarList from "@/utils/sidebarList";
import ReportsPage from "./ReportsPage";

const get = vi.fn();
const workspace = vi.fn();
const downloads: { name: string; text: string }[] = [];
vi.mock("@/lib/authSession", () => ({ getStoredUser: () => ({ session_mode: "organization", access_token: "token" }), clearAuthSession: vi.fn() }));
vi.mock("@/lib/axios", () => ({ default: { get: (...args: unknown[]) => get(...args) } }));
vi.mock("@/hooks/organization/useWorkspace", () => ({ default: () => workspace() }));
vi.mock("@/utils/attendance/paperRegister", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/attendance/paperRegister")>();
  return { ...actual, downloadCsv: (name: string, text: string) => downloads.push({ name, text }) };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/attendance-reports" }));

const ok = <T,>(payload: T) => Promise.resolve({ data: { payload } });
const failWith = (status: number, code: string) => Promise.reject({ response: { status, data: { code, message: code } } });

const SECTIONS: PaperRegisterSection[] = [
  { id: "s8a", name: "A", class_name: "Class 8", mode: "SELF_CHECKIN" },
  { id: "s9a", name: "A", class_name: "Class 9", mode: "PAPER_REGISTER" },
];
const day = (status: ReportDayStatus, missed = 0): ReportDayMark => ({ status, missed, waiting: 0 });
const counts = { students: 0, present: 0, late: 0, absent: 0, leave: 0, waiting: 0, flagged: 0 };

const DAILY: DailyAttendanceReport = {
  date: "2026-11-14",
  today: "2026-11-15",
  time_zone: "Asia/Dhaka",
  closed: null,
  sections: [
    {
      section: { id: "s8a", name: "A", class_name: "Class 8" },
      mode: "SELF_CHECKIN",
      classes: [
        { slot_id: "x1", start_time: "09:00", end_time: "10:00", teacher: null, state: "CLOSED", cancelled: false, counts },
        { slot_id: "x2", start_time: "10:00", end_time: "11:00", teacher: null, state: "CLOSED", cancelled: true, counts },
      ],
      counts: { students: 4, present: 1, late: 1, absent: 1, leave: 1, waiting: 0, missed_some: 1 },
      students: [
        { id: "u1", full_name: "Rahim", roll_no: "1", marks: ["PRESENT", "ABSENT"], day: day("PRESENT", 1) },
        { id: "u2", full_name: "Karim", roll_no: "2", marks: ["LATE", "LATE"], day: day("LATE") },
        { id: "u3", full_name: "Salma", roll_no: "3", marks: ["LEAVE", "LEAVE"], day: day("LEAVE") },
        { id: "u4", full_name: "Jamal", roll_no: "4", marks: ["ABSENT", "ABSENT"], day: day("ABSENT") },
      ],
    },
  ],
};

const MONTHLY: MonthlyAttendanceReport = {
  section: { id: "s8a", name: "A", class_name: "Class 8" },
  month: "2026-11",
  today: "2026-11-15",
  mode: "SELF_CHECKIN",
  can_import: false,
  classes: [
    { header: "2026-11-07", date: "2026-11-07", start_time: "09:00", end_time: "10:00", slot_id: "x1" },
    { header: "2026-11-14 09:00", date: "2026-11-14", start_time: "09:00", end_time: "10:00", slot_id: "x1" },
    { header: "2026-11-14 10:00", date: "2026-11-14", start_time: "10:00", end_time: "11:00", slot_id: "x2" },
  ],
  days: [
    { date: "2026-11-07", classes: 1 },
    { date: "2026-11-14", classes: 2 },
  ],
  students: [
    {
      id: "u1", full_name: "রহিম", roll_no: "1", marks: ["PRESENT", "PRESENT", "ABSENT"],
      days: [day("PRESENT"), day("PRESENT", 1)], counts: { present: 2, late: 0, absent: 1, leave: 0 }, attendance_pct: 67,
    },
    {
      id: "u2", full_name: "Karim", roll_no: "2", marks: ["ABSENT", "LATE", "LEAVE"],
      days: [day("ABSENT"), day("LATE")], counts: { present: 0, late: 1, absent: 1, leave: 1 }, attendance_pct: 50,
    },
  ],
  counts: { present: 2, late: 1, absent: 2, leave: 1 },
  attendance_pct: 60,
};

const TEACHERS: TeacherAttendanceReport = {
  from: "2026-11-01",
  to: "2026-11-15",
  today: "2026-11-15",
  teachers: [
    {
      teacher: { id: "t1", full_name: "Rina Akter" },
      counts: { present: 3, late: 1, absent: 1, leave: 0 },
      attendance_pct: 80,
      late_minutes: 5,
      classes: [
        { date: "2026-11-07", section: { id: "s8a", name: "A", class_name: "Class 8" }, start_time: "09:00", end_time: "10:00", status: "ABSENT", late_minutes: null },
        { date: "2026-11-14", section: { id: "s8a", name: "A", class_name: "Class 8" }, start_time: "09:00", end_time: "10:00", status: "LATE", late_minutes: 5 },
      ],
    },
  ],
};

const serve = (overrides: Record<string, () => Promise<unknown>> = {}) =>
  get.mockImplementation((url: string) => {
    for (const [suffix, answer] of Object.entries(overrides)) if (url.endsWith(suffix)) return answer();
    if (url.endsWith("/attendance/register/sections")) return ok(SECTIONS);
    if (url.endsWith("/attendance/reports/daily")) return ok(DAILY);
    if (url.endsWith("/attendance/reports/sections/s8a/month")) return ok(MONTHLY);
    if (url.endsWith("/attendance/reports/teachers")) return ok(TEACHERS);
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });
const owner = { activeOrganization: { id: "o1", name: "Udvash Academy", role: "OWNER" }, isIndividual: false, memberRole: "OWNER" };
const printSheet = () => document.getElementById("attendance-print") as HTMLElement;

beforeEach(() => {
  vi.clearAllMocks();
  downloads.length = 0;
  workspace.mockReturnValue(owner);
});

afterEach(cleanup);

describe("attendance reports page (ATT-13)", () => {
  it("shows the daily summary per section: students grouped by their day, with counts and names, most urgent first", async () => {
    serve();
    renderApp(<ReportsPage />);
    // The section list loads first (the select has "Class 8 A" too); wait for the report.
    expect(await screen.findByText("Self check-in · 2 classes: 09:00–10:00, 10:00–11:00 (cancelled) · 4 students")).toBeTruthy();
    const groups = screen.getAllByRole("term").map((term) => `${term.textContent} → ${term.nextElementSibling?.textContent}`);
    expect(groups).toEqual(["Absent all day · 1 → Jamal", "Missed some classes · 1 → Rahim (missed 1)", "Late · 1 → Karim", "On leave · 1 → Salma"]);
    // The print sheet has the same lists under the date.
    const sheet = within(printSheet());
    expect(sheet.getByRole("heading", { name: "Daily attendance summary", hidden: true })).toBeTruthy();
    expect(sheet.getByText("Saturday, 14 November 2026")).toBeTruthy();
    expect(sheet.getAllByRole("term", { hidden: true })).toHaveLength(4);
    expect(get).toHaveBeenCalledWith(expect.stringMatching(/\/attendance\/reports\/daily$/), { params: {} });
  });

  it("asks for another date and one section", async () => {
    serve();
    renderApp(<ReportsPage />);
    await screen.findByText(/4 students/);
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-11-07" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Section" }), { target: { value: "s8a" } });
    await waitFor(() =>
      expect(get).toHaveBeenLastCalledWith(expect.stringMatching(/\/attendance\/reports\/daily$/), { params: { date: "2026-11-07", section_id: "s8a" } }),
    );
  });

  it("shows the monthly register grid with letters, counts and %, prints it and exports the register CSV", async () => {
    serve();
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    renderApp(<ReportsPage />);
    fireEvent.click(await screen.findByRole("tab", { name: "Monthly register" }));
    const table = within(await screen.findByRole("table", { name: "Students by class day" }));
    const karim = within(table.getByText("Karim").closest("tr") as HTMLElement);
    expect(karim.getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["2", "Karim", "A", "L", "0", "1", "1", "1", "50%"]);
    expect(table.getByRole("img", { name: "Present, missed 1 class" }).textContent).toBe("P1");
    expect(screen.getByText(/2 class days, 3 classes, 2 students · attendance 60%/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Print / Save as PDF" }));
    expect(print).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Export CSV (Excel)" }));
    // P3-05's register format: roll, name, one column per class.
    expect(downloads).toEqual([
      { name: "class-8-a-2026-11-register.csv", text: "roll_no,name,2026-11-07,2026-11-14 09:00,2026-11-14 10:00\n1,রহিম,P,P,A\n2,Karim,A,L,Leave" },
    ]);
  });

  it("prints the register in English: organisation, section, month, a repeated header row and the letter legend", async () => {
    serve();
    renderApp(<ReportsPage />);
    fireEvent.click(await screen.findByRole("tab", { name: "Monthly register" }));
    await screen.findByRole("table", { name: "Students by class day" });
    const sheet = within(printSheet());
    expect(sheet.getByText("Udvash Academy")).toBeTruthy();
    expect(sheet.getByRole("heading", { name: "Monthly attendance register", hidden: true })).toBeTruthy();
    expect(sheet.getByText("Class 8 A · November 2026")).toBeTruthy();
    expect(printSheet().querySelector("thead")?.textContent).toBe("RollName714PLALV%");
    expect(sheet.getByRole("list", { name: "Letters", hidden: true }).textContent).toContain("PPresent");
    expect(printSheet().querySelector("style")?.textContent).toContain("size: A4 landscape");
    expect(printSheet().querySelector("style")?.textContent).toContain("thead { display: table-header-group; }");
  });

  it("prints the register in Bangla with Bangla letters and digits", async () => {
    serve();
    renderApp(<ReportsPage />, { locale: "bn" });
    fireEvent.click(await screen.findByRole("tab", { name: "মাসিক হাজিরা খাতা" }));
    await screen.findByRole("table", { name: "ক্লাসের দিন অনুযায়ী শিক্ষার্থী" });
    const sheet = within(printSheet());
    expect(sheet.getByRole("heading", { name: "মাসিক হাজিরা খাতা", hidden: true })).toBeTruthy();
    expect(printSheet().querySelector("thead")?.textContent).toBe("রোলনাম৭১৪উদেঅছু%");
    const rahim = printSheet().querySelector("tbody tr") as HTMLElement;
    expect([...rahim.querySelectorAll("td")].map((cell) => cell.textContent)).toEqual(["1", "রহিম", "উ", "উ১", "২", "০", "১", "০", "৬৭%"]);
    expect(sheet.getByRole("list", { name: "অক্ষর", hidden: true }).textContent).toContain("ছুছুটিতে");
  });

  it("shows the teacher report to owners and admins, with the classes not on time and a CSV", async () => {
    serve();
    renderApp(<ReportsPage />);
    fireEvent.click(await screen.findByRole("tab", { name: "Teachers" }));
    const summary = within(await screen.findByRole("table", { name: "Teachers" }));
    const rina = within(summary.getByText("Rina Akter").closest("tr") as HTMLElement);
    expect(rina.getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["Rina Akter", "3", "1", "1", "0", "80%", "5"]);
    const late = within(screen.getByRole("table", { name: "Classes not on time" }));
    expect(late.getByText("Late · 5 min late")).toBeTruthy();
    expect(late.getByText("Absent")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Export CSV (Excel)" }));
    expect(downloads).toEqual([
      { name: "teachers-2026-11-01-2026-11-15.csv", text: "Teacher,Present,Late,Absent,Leave,Attendance %,Minutes late\nRina Akter,3,1,1,0,80,5" },
    ]);
    fireEvent.click(screen.getByRole("button", { name: "This month" }));
    await waitFor(() =>
      expect(get).toHaveBeenLastCalledWith(expect.stringMatching(/\/attendance\/reports\/teachers$/), { params: { from: "2026-11-01", to: "2026-11-30" } }),
    );
  });

  it("explains a range that is too long", async () => {
    serve({ "/attendance/reports/teachers": () => failWith(400, "ATTENDANCE_REPORT_RANGE_TOO_LONG") });
    renderApp(<ReportsPage />);
    fireEvent.click(await screen.findByRole("tab", { name: "Teachers" }));
    expect(await screen.findByText("Choose at most 31 days.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("has no teacher report for teachers, assistants or a solo teacher's own workspace", async () => {
    serve();
    for (const value of [
      { ...owner, memberRole: "TEACHER" },
      { ...owner, memberRole: "ASSISTANT" },
      { activeOrganization: null, isIndividual: true, memberRole: undefined },
    ]) {
      workspace.mockReturnValue(value);
      renderApp(<ReportsPage />);
      await screen.findByRole("tab", { name: "Daily summary" });
      expect(screen.queryByRole("tab", { name: "Teachers" })).toBeNull();
      cleanup();
    }
  });

  it("is in the menu for every staff role and in a solo teacher's own workspace", () => {
    const items = sidebarList.filter((item) => item.route === "/attendance-reports");
    expect(items).toEqual([
      expect.objectContaining({ category: "Organization", memberRoles: ["OWNER", "ADMIN", "ASSISTANT", "TEACHER"], feature: "attendance" }),
      expect.objectContaining({ category: "Platform", personalWorkspaceOnly: true, feature: "attendance" }),
    ]);
  });
});
