import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/i18n/test-utils";
import sidebarList from "@/utils/sidebarList";
import ClassAttendancePage from "./ClassAttendancePage";

const get = vi.fn();
const put = vi.fn();
vi.mock("@/lib/authSession", () => ({ getStoredUser: () => ({ session_mode: "organization", access_token: "token" }), clearAuthSession: vi.fn() }));
vi.mock("@/lib/axios", () => ({
  default: {
    get: (...args: unknown[]) => get(...args),
    put: (...args: unknown[]) => put(...args),
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/attendance" }));

const ok = <T,>(payload: T) => Promise.resolve({ data: { payload } });
const failWith = (status: number, code: string) => Promise.reject({ response: { status, data: { code, message: code } } });

const SUMMARY: ClassSessionSummary = {
  slot_id: "slot-8",
  date: "2026-11-07",
  section: { id: "s8", name: "A", class_name: "Class 8" },
  start_time: "16:00",
  end_time: "17:30",
  class_type: "IN_PERSON",
  mode: "SELF_CHECKIN",
  starts_at: "2026-11-07T10:00:00.000Z",
  late_after: "2026-11-07T10:10:00.000Z",
  ends_at: "2026-11-07T11:30:00.000Z",
  state: "CLOSED",
  closed: null,
  teacher: { id: "t1", full_name: "Rina Akter" },
  counts: { students: 2, present: 0, late: 1, absent: 1, leave: 0, waiting: 0, flagged: 1 },
  can_correct: true,
};
const record = (status: AttendanceStatus, extra: Partial<AttendanceRecord> = {}): AttendanceRecord => ({
  id: `r-${status}`,
  status,
  checked_in_at: "2026-11-07T10:20:00.000Z",
  late_minutes: status === "LATE" ? 20 : null,
  source: "SELF",
  distance_m: 89,
  accuracy_m: 60,
  flag: null,
  ...extra,
});
const RAHIM: ClassRosterRow = {
  person: { id: "p-rahim", full_name: "Rahim", roll_no: "1" },
  role: "STUDENT",
  status: "LATE",
  record: record("LATE", { flag: "EDGE_ACCURACY" }),
  corrections: [],
  can_correct: true,
};
const KARIM: ClassRosterRow = { person: { id: "p-karim", full_name: "Karim", roll_no: "2" }, role: "STUDENT", status: "ABSENT", record: null, corrections: [], can_correct: true };
const TEACHER_ROW: ClassRosterRow = { person: { id: "t1", full_name: "Rina Akter", roll_no: null }, role: "TEACHER", status: "PRESENT", record: record("PRESENT"), corrections: [], can_correct: false };
const DETAIL: ClassSessionDetail = { ...SUMMARY, students: [RAHIM, KARIM], teachers: [TEACHER_ROW] };
const LIST: ClassSessionsOnDate = { date: "2026-11-07", today: "2026-11-07", time_zone: "Asia/Dhaka", closed: null, sessions: [SUMMARY] };

const serve = (list = LIST, detail = DETAIL) =>
  get.mockImplementation((url: string) => {
    if (url.endsWith("/attendance/sessions")) return ok(list);
    if (url.endsWith("/attendance/sessions/slot-8/2026-11-07")) return ok(detail);
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("class attendance page (ATT-07, ATT-12)", () => {
  it("lists the day's classes with counts, and opens a class with every student's status, flag and the teacher", async () => {
    serve();
    renderApp(<ClassAttendancePage />);
    const table = within(await screen.findByRole("table"));
    expect(table.getByText("Class 8 A")).toBeTruthy();
    expect(table.getByText("L 1")).toBeTruthy();
    expect(table.getByText("A 1")).toBeTruthy();
    expect(table.getByText("Flagged 1")).toBeTruthy();

    fireEvent.click(table.getByRole("button", { name: "Open Class 8 A" }));
    const drawer = await screen.findByRole("dialog");
    expect(await within(drawer).findByText("1. Rahim")).toBeTruthy();
    expect(within(drawer).getByRole("img", { name: "Late" }).textContent).toBe("L");
    expect(within(drawer).getByText(/Late by 20 min · checked in at 16:20 · 89 m away \(±60 m\)/)).toBeTruthy();
    expect(within(drawer).getByText("Unclear location at the edge")).toBeTruthy();
    expect(within(drawer).getByRole("img", { name: "Absent" }).textContent).toBe("A");
    // The teacher's own row cannot be corrected here.
    expect(within(drawer).queryByRole("button", { name: "Correct Rina Akter" })).toBeNull();
  });

  it("corrects Absent to Present with a reason and shows the trail", async () => {
    serve();
    const corrected: ClassSessionDetail = {
      ...DETAIL,
      counts: { ...DETAIL.counts, present: 1, absent: 0 },
      students: [
        RAHIM,
        {
          ...KARIM,
          status: "PRESENT",
          record: record("PRESENT", { source: "CORRECTION", checked_in_at: null, distance_m: null, accuracy_m: null }),
          corrections: [{ id: "c1", old_status: null, new_status: "PRESENT", reason: "Phone had no internet", corrected_by: { id: "t1", full_name: "Rina Akter" }, created_at: "2026-11-07T12:00:00.000Z" }],
        },
      ],
    };
    put.mockImplementation(() => ok(corrected));
    renderApp(<ClassAttendancePage />);
    fireEvent.click(within(await screen.findByRole("table")).getByRole("button", { name: "Open Class 8 A" }));
    const drawer = await screen.findByRole("dialog");
    fireEvent.click(await within(drawer).findByRole("button", { name: "Correct Karim" }));

    // A reason is needed.
    fireEvent.click(within(drawer).getByRole("button", { name: "Save correction" }));
    expect(within(drawer).getByRole("alert").textContent).toBe("Write why you are correcting this (at least 3 characters).");
    expect(put).not.toHaveBeenCalled();

    expect((within(drawer).getByLabelText("New status") as HTMLSelectElement).value).toBe("PRESENT");
    fireEvent.change(within(drawer).getByLabelText(/Reason/), { target: { value: "Phone had no internet" } });
    fireEvent.click(within(drawer).getByRole("button", { name: "Save correction" }));
    await waitFor(() => expect(put).toHaveBeenCalled());
    expect(put.mock.calls[0][0]).toMatch(/\/attendance\/sessions\/slot-8\/2026-11-07\/records\/p-karim$/);
    expect(put.mock.calls[0][1]).toEqual({ status: "PRESENT", reason: "Phone had no internet" });
    const trail = await within(drawer).findByRole("list", { name: "Corrections of Karim" });
    expect(trail.textContent).toContain("No check-in → Present by Rina Akter");
    expect(trail.textContent).toContain("Phone had no internet");
    expect(within(screen.getByRole("table", { hidden: true })).getByText("P 1")).toBeTruthy();
  });

  it("sends minutes for a Late correction and explains a refused one", async () => {
    serve();
    put.mockImplementation(() => failWith(400, "ATTENDANCE_CORRECTION_NO_CHANGE"));
    renderApp(<ClassAttendancePage />);
    fireEvent.click(within(await screen.findByRole("table")).getByRole("button", { name: "Open Class 8 A" }));
    const drawer = await screen.findByRole("dialog");
    fireEvent.click(await within(drawer).findByRole("button", { name: "Correct Karim" }));
    fireEvent.change(within(drawer).getByLabelText("New status"), { target: { value: "LATE" } });
    fireEvent.change(within(drawer).getByLabelText("Minutes late"), { target: { value: "12" } });
    fireEvent.change(within(drawer).getByLabelText(/Reason/), { target: { value: "Came after the bell" } });
    fireEvent.click(within(drawer).getByRole("button", { name: "Save correction" }));
    await waitFor(() => expect(put).toHaveBeenCalled());
    expect(put.mock.calls[0][1]).toEqual({ status: "LATE", reason: "Came after the bell", late_minutes: 12 });
    expect((await within(drawer).findByRole("alert")).textContent).toBe("The record already has this status.");
  });

  it("shows no Correct button before a class starts, and an empty day", async () => {
    serve(LIST, { ...DETAIL, state: "UPCOMING", can_correct: false, students: [{ ...KARIM, status: "UPCOMING", can_correct: false }], teachers: [] });
    renderApp(<ClassAttendancePage />);
    fireEvent.click(within(await screen.findByRole("table")).getByRole("button", { name: "Open Class 8 A" }));
    const drawer = await screen.findByRole("dialog");
    expect(await within(drawer).findByText("Corrections open when the class starts.")).toBeTruthy();
    expect(within(drawer).queryByRole("button", { name: /^Correct/ })).toBeNull();

    cleanup();
    serve({ ...LIST, sessions: [], closed: { date: "2026-11-07", reason: "WEEKLY_OFF" } });
    renderApp(<ClassAttendancePage />);
    expect(await screen.findByText("No classes on this day")).toBeTruthy();
    expect(screen.getByText("Weekly off day: no classes.")).toBeTruthy();
  });

  it("speaks Bangla", async () => {
    serve();
    renderApp(<ClassAttendancePage />, { locale: "bn" });
    expect(await screen.findByRole("heading", { name: "ক্লাসের উপস্থিতি" })).toBeTruthy();
    expect(within(await screen.findByRole("table")).getByText("দে ১")).toBeTruthy();
  });

  it("puts Class attendance in the menu for staff and a solo teacher's own workspace, behind the attendance feature", () => {
    const items = sidebarList.filter((item) => item.route === "/attendance");
    expect(items).toEqual([
      expect.objectContaining({ category: "Organization", memberRoles: ["OWNER", "ADMIN", "ASSISTANT", "TEACHER"], feature: "attendance" }),
      expect.objectContaining({ category: "Platform", role: ["TEACHER"], personalWorkspaceOnly: true, feature: "attendance" }),
    ]);
  });
});
