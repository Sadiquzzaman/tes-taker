import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/i18n/test-utils";
import ClassAttendancePage from "./ClassAttendancePage";

const get = vi.fn();
const post = vi.fn();
vi.mock("@/lib/authSession", () => ({ getStoredUser: () => ({ session_mode: "organization", access_token: "token" }), clearAuthSession: vi.fn() }));
vi.mock("@/hooks/organization/useWorkspace", () => ({ default: () => ({ memberRole: "OWNER", isIndividual: false, organizationId: "org1" }) }));
vi.mock("@/lib/axios", () => ({
  default: {
    get: (...args: unknown[]) => get(...args),
    post: (...args: unknown[]) => post(...args),
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/attendance" }));

const ok = <T,>(payload: T) => Promise.resolve({ data: { payload } });

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
  state: "UPCOMING",
  closed: null,
  teacher: { id: "t1", full_name: "Rina Akter" },
  counts: { students: 1, present: 0, late: 0, absent: 0, leave: 0, waiting: 1, flagged: 0 },
  cancelled: null,
  change: null,
  can_correct: false,
  can_cancel: true,
  can_restore: false,
  can_change: true,
};
const DETAIL: ClassSessionDetail = { ...SUMMARY, students: [], teachers: [] };
const CHANGED: ClassSessionDetail = {
  ...DETAIL,
  start_time: "14:00",
  end_time: "15:30",
  starts_at: "2026-11-07T08:00:00.000Z",
  ends_at: "2026-11-07T09:30:00.000Z",
  teacher: { id: "t2", full_name: "Karim Uddin" },
  change: {
    routine_start_time: "16:00",
    routine_end_time: "17:30",
    substitute: { id: "t2", full_name: "Karim Uddin" },
    at: "2026-11-07T04:00:00.000Z",
    by: { id: "o1", full_name: "Owner" },
    note: "After the exam",
  },
};

const serve = (detail: ClassSessionDetail = DETAIL, summary: ClassSessionSummary = SUMMARY) =>
  get.mockImplementation((url: string) => {
    if (url.endsWith("/attendance/sessions")) return ok({ date: "2026-11-07", today: "2026-11-07", time_zone: "Asia/Dhaka", closed: null, sessions: [summary] });
    if (url.endsWith("/attendance/sessions/slot-8/2026-11-07")) return ok(detail);
    if (url.endsWith("/organizations/org1/assignable-teachers"))
      return ok([
        { id: "m1", role: "TEACHER", user: { id: "t1", full_name: "Rina Akter", email: null, phone: null } },
        { id: "m2", role: "TEACHER", user: { id: "t2", full_name: "Karim Uddin", email: null, phone: null } },
      ]);
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });

const openClass = async () => {
  fireEvent.click(within(await screen.findByRole("table")).getByRole("button", { name: "Open Class 8 A" }));
  return within(await screen.findByRole("dialog"));
};

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("changing a class for one day (P5-04, CAL-01)", () => {
  it("gives the class other times and a substitute for the day, with a note, and shows the change", async () => {
    serve();
    post.mockReturnValue(ok(CHANGED));
    renderApp(<ClassAttendancePage />);
    const drawer = await openClass();
    fireEvent.click(await drawer.findByRole("button", { name: "Change time or teacher" }));
    expect((drawer.getByLabelText("Start") as HTMLInputElement).value).toBe("16:00");
    // The routine's own teacher is the empty choice, not in the list.
    const teacher = drawer.getByLabelText("Teacher this day") as HTMLSelectElement;
    await waitFor(() => expect([...teacher.options].map((o) => o.textContent)).toEqual(["As in the routine (Rina Akter)", "Karim Uddin"]));
    fireEvent.change(drawer.getByLabelText("Start"), { target: { value: "14:00" } });
    fireEvent.change(drawer.getByLabelText("End"), { target: { value: "15:30" } });
    fireEvent.change(teacher, { target: { value: "t2" } });
    fireEvent.change(drawer.getByLabelText(/Note for students/), { target: { value: " After the exam " } });
    fireEvent.click(drawer.getByRole("button", { name: "Save change" }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post.mock.calls[0][0]).toMatch(/\/attendance\/sessions\/slot-8\/2026-11-07\/change$/);
    expect(post.mock.calls[0][1]).toEqual({ start_time: "14:00", end_time: "15:30", substitute_teacher_id: "t2", note: "After the exam" });
    expect(await drawer.findByText("Changed for this day only")).toBeTruthy();
    expect(drawer.getByText("Substitute teacher: Karim Uddin")).toBeTruthy();
    expect(drawer.getByText("Note: After the exam")).toBeTruthy();
    expect(within(screen.getByRole("table", { hidden: true })).getByText("Changed today")).toBeTruthy();
  });

  it("undoes a change, and explains a refused one", async () => {
    serve(CHANGED, CHANGED);
    post
      .mockImplementationOnce(() => Promise.reject({ response: { status: 409, data: { code: "ATTENDANCE_CHANGE_OVERLAP", details: { start_time: "18:00", end_time: "19:00" } } } }))
      .mockReturnValueOnce(ok(DETAIL));
    renderApp(<ClassAttendancePage />);
    const drawer = await openClass();
    fireEvent.click(await drawer.findByRole("button", { name: "Edit change" }));
    fireEvent.change(drawer.getByLabelText("End"), { target: { value: "18:30" } });
    fireEvent.click(drawer.getByRole("button", { name: "Save change" }));
    expect(await drawer.findByText("The section has another class at that time (18:00–19:00).")).toBeTruthy();
    fireEvent.click(drawer.getByRole("button", { name: "Keep as is" }));
    fireEvent.click(drawer.getByRole("button", { name: "Undo change" }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect(post.mock.calls[1][1]).toEqual({ start_time: "16:00", end_time: "17:30", substitute_teacher_id: null });
    expect(await drawer.findByRole("button", { name: "Change time or teacher" })).toBeTruthy();
  });

  it("offers no change once check-in has opened, in Bangla too", async () => {
    serve({ ...DETAIL, can_change: false });
    renderApp(<ClassAttendancePage />, { locale: "bn" });
    fireEvent.click(within(await screen.findByRole("table")).getByRole("button", { name: "Class 8 A খুলুন" }));
    const drawer = within(await screen.findByRole("dialog"));
    expect(await drawer.findByRole("button", { name: "এই ক্লাস বাতিল করুন" })).toBeTruthy();
    expect(drawer.queryByRole("button", { name: "সময় বা শিক্ষক বদলান" })).toBeNull();
  });
});
