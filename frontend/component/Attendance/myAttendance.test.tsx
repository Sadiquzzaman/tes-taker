import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/i18n/test-utils";
import { shiftMonth, todayStatus } from "@/utils/attendance/status";
import sidebarList from "@/utils/sidebarList";
import MyAttendancePage from "./MyAttendancePage";

const get = vi.fn();
const post = vi.fn();
vi.mock("@/lib/authSession", () => ({ getStoredUser: () => ({ session_mode: "organization", access_token: "token" }), clearAuthSession: vi.fn() }));
vi.mock("@/lib/axios", () => ({
  default: {
    get: (...args: unknown[]) => get(...args),
    post: (...args: unknown[]) => post(...args),
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/my-attendance" }));

const ok = <T,>(payload: T) => Promise.resolve({ data: { payload } });
const failWith = (status: number, code: string, details?: unknown) => Promise.reject({ response: { status, data: { code, message: code, details } } });

const cls = (extra: Partial<MyClass> = {}): MyClass => ({
  slot_id: "slot-1",
  date: "2026-11-07",
  role: "STUDENT",
  section: { id: "s1", name: "A", class_name: "Class 8" },
  class_type: "IN_PERSON",
  mode: "SELF_CHECKIN",
  start_time: "16:00",
  end_time: "17:30",
  opens_at: "2026-11-07T09:45:00.000Z",
  starts_at: "2026-11-07T10:00:00.000Z",
  late_after: "2026-11-07T10:10:00.000Z",
  ends_at: "2026-11-07T11:30:00.000Z",
  state: "OPEN",
  needs_location: true,
  blocked: null,
  can_check_in: true,
  record: null,
  ...extra,
});
const TODAY = (classes: MyClass[], closed: ClosedDay | null = null): MyToday => ({
  date: "2026-11-07",
  server_time: "2026-11-07T10:05:00.000Z",
  time_zone: "Asia/Dhaka",
  closed,
  classes,
});
const record = (status: AttendanceStatus, extra: Partial<AttendanceRecord> = {}): AttendanceRecord => ({
  id: "r1",
  status,
  checked_in_at: "2026-11-07T10:20:00.000Z",
  late_minutes: status === "LATE" ? 20 : null,
  source: "SELF",
  distance_m: 12,
  accuracy_m: 15,
  flag: null,
  ...extra,
});
const day = (date: string, classes: MyCalendar["days"][number]["classes"] = [], closed: ClosedDay | null = null) => ({ date, closed, classes });
const calClass = (status: CalendarStatus) => ({
  slot_id: "slot-1",
  role: "STUDENT" as const,
  section: { id: "s1", name: "A", class_name: "Class 8" },
  start_time: "16:00",
  end_time: "17:30",
  status,
  record: null,
});
const CALENDAR: MyCalendar = {
  month: "2026-11",
  today: "2026-11-14",
  time_zone: "Asia/Dhaka",
  days: Array.from({ length: 30 }, (_, i) => {
    const date = `2026-11-${String(i + 1).padStart(2, "0")}`;
    if (date === "2026-11-07") return day(date, [calClass("LATE")]);
    if (date === "2026-11-14") return day(date, [calClass("ABSENT")]);
    if (date === "2026-11-21") return day(date, [calClass("CLOSED_DAY")], { date, reason: "HOLIDAY", holiday_name: "Holiday" });
    if (date === "2026-11-28") return day(date, [calClass("UPCOMING")]);
    return day(date);
  }),
  counts: { present: 0, late: 1, absent: 1, leave: 0 },
  attendance_pct: 50,
};

const serve = (today: MyToday, calendar: MyCalendar = CALENDAR) =>
  get.mockImplementation((url: string) => {
    if (url.endsWith("/attendance/me/today")) return ok(today);
    if (url.endsWith("/attendance/me/calendar")) return ok(calendar);
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });

const position = (coords: Partial<GeolocationCoordinates>) => {
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: { getCurrentPosition: (resolve: PositionCallback) => resolve({ coords: { latitude: 23.758, longitude: 90.389, accuracy: 15, ...coords } } as GeolocationPosition) },
  });
};
const noPosition = (code: number) => {
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: { getCurrentPosition: (_: PositionCallback, reject: PositionErrorCallback) => reject({ code } as GeolocationPositionError) },
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  position({});
});

afterEach(cleanup);

describe("my attendance page (ATT-04, ATT-18)", () => {
  it("checks in to an open in-person class with the browser's position and shows Late with minutes", async () => {
    serve(TODAY([cls()]));
    post.mockImplementation(() => ok(cls({ can_check_in: false, record: record("LATE") })));
    renderApp(<MyAttendancePage />);

    const button = await screen.findByRole("button", { name: "Check in to Class 8 A" });
    expect(screen.getByText("16:00–17:30 · In person")).toBeTruthy();
    fireEvent.click(button);
    await waitFor(() => expect(post).toHaveBeenCalled());
    const [url, body] = post.mock.calls[0];
    expect(url).toMatch(/\/attendance\/check-in$/);
    expect(body).toEqual({ slot_id: "slot-1", latitude: 23.758, longitude: 90.389, accuracy_m: 15 });
    expect(await screen.findByText("Late by 20 min")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Check in to Class 8 A" })).toBeNull();
  });

  it("sends no position for an online class", async () => {
    serve(TODAY([cls({ class_type: "ONLINE", needs_location: false })]));
    post.mockImplementation(() => ok(cls({ class_type: "ONLINE", needs_location: false, can_check_in: false, record: record("PRESENT") })));
    renderApp(<MyAttendancePage />);
    fireEvent.click(await screen.findByRole("button", { name: "Check in to Class 8 A" }));
    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0][1]).toEqual({ slot_id: "slot-1" });
  });

  it("explains a check-in that is too far away or not accurate enough", async () => {
    serve(TODAY([cls()]));
    post.mockImplementationOnce(() => failWith(400, "ATTENDANCE_CHECKIN_TOO_FAR", { distance_m: 340, radius_m: 100 }));
    renderApp(<MyAttendancePage />);
    fireEvent.click(await screen.findByRole("button", { name: "Check in to Class 8 A" }));
    expect((await screen.findByRole("alert")).textContent).toBe("You are 340 m away. Check in within 100 m of your class.");

    post.mockImplementationOnce(() => failWith(400, "ATTENDANCE_CHECKIN_ACCURACY_POOR", { accuracy_m: 150 }));
    fireEvent.click(screen.getByRole("button", { name: "Check in to Class 8 A" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Your location isn't accurate enough (150 m). Move near a window and try again."));
  });

  it("asks to allow location when the browser refuses it, without calling the server", async () => {
    noPosition(1);
    serve(TODAY([cls()]));
    renderApp(<MyAttendancePage />);
    fireEvent.click(await screen.findByRole("button", { name: "Check in to Class 8 A" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Allow location for this site in your browser, then try again.");
    expect(post).not.toHaveBeenCalled();
  });

  it("shows when check-in opens, paper registers, a missing pin and a holiday, without a button", async () => {
    serve(
      TODAY([
        cls({ slot_id: "a", state: "UPCOMING", can_check_in: false }),
        cls({ slot_id: "b", section: { id: "s2", name: "B", class_name: "Class 8" }, mode: "PAPER_REGISTER", blocked: "PAPER_REGISTER", can_check_in: false }),
        cls({ slot_id: "c", section: { id: "s3", name: "C", class_name: "Class 8" }, blocked: "NO_PIN", can_check_in: false }),
      ]),
    );
    renderApp(<MyAttendancePage />);
    expect(await screen.findByText(/Check-in opens at 15:45/)).toBeTruthy();
    expect(screen.getByText("Attendance for this class is kept on paper.")).toBeTruthy();
    expect(screen.getByText("The check-in location of this class isn't set yet. Ask your admin.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Check in to/ })).toBeNull();

    cleanup();
    serve(TODAY([], { date: "2026-11-07", reason: "HOLIDAY", holiday_name: "Victory Day" }));
    renderApp(<MyAttendancePage />);
    expect(await screen.findByText("Holiday: no classes. Victory Day")).toBeTruthy();
    expect(screen.getByText("No classes today")).toBeTruthy();
  });

  it("draws the month Saturday first with a letter on every coloured mark, the counts and the %", async () => {
    serve(TODAY([]));
    renderApp(<MyAttendancePage />);
    const grid = await screen.findByRole("grid", { name: "Attendance in November 2026" });
    expect(within(grid).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"]);
    const late = within(grid).getByRole("img", { name: "Class 8 A, 16:00: Late" });
    expect(late.textContent).toBe("L");
    expect(late.className).toContain("bg-warning");
    const absent = within(grid).getByRole("img", { name: "Class 8 A, 16:00: Absent" });
    expect(absent.textContent).toBe("A");
    expect(absent.className).toContain("bg-danger");
    expect(within(grid).getByRole("img", { name: "Class 8 A, 16:00: Holiday or off day" }).textContent).toBe("H");
    expect(within(grid).getByRole("img", { name: "Class 8 A, 16:00: Upcoming" }).className).toContain("bg-canvas");
    expect(screen.getByText("50%")).toBeTruthy();
    expect(within(screen.getByRole("list", { name: "What the marks mean" })).getAllByRole("listitem")).toHaveLength(6);

    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    await waitFor(() => expect(get).toHaveBeenCalledWith(expect.stringMatching(/\/attendance\/me\/calendar$/), { params: { month: "2026-12" } }));
  });

  it("speaks Bangla, with Bangla letters and digits", async () => {
    serve(TODAY([cls({ state: "UPCOMING", can_check_in: false })]));
    renderApp(<MyAttendancePage />, { locale: "bn" });
    expect(await screen.findByRole("heading", { name: "আমার উপস্থিতি" })).toBeTruthy();
    const grid = await screen.findByRole("grid");
    expect(within(grid).getByRole("img", { name: /দেরি$/ }).textContent).toBe("দে");
    expect(screen.getByText("৫০%")).toBeTruthy();
  });

  it("puts My attendance in the student menu and for every staff role, behind the attendance feature", () => {
    const items = sidebarList.filter((item) => item.route === "/my-attendance");
    expect(items).toEqual([
      expect.objectContaining({ category: "Platform", role: ["STUDENT"], feature: "attendance" }),
      expect.objectContaining({ category: "Organization", memberRoles: ["OWNER", "ADMIN", "ASSISTANT", "TEACHER"], feature: "attendance" }),
    ]);
  });

  it("works out today's status and the month steps", () => {
    expect(todayStatus(cls({ record: record("PRESENT") }))).toBe("PRESENT");
    expect(todayStatus(cls({ state: "CLOSED", can_check_in: false }))).toBe("ABSENT");
    expect(todayStatus(cls({ state: "CLOSED", mode: "PAPER_REGISTER" }))).toBe("NOT_RECORDED");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });
});
