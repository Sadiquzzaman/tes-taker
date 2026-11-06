import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/i18n/test-utils";
import { addDays } from "@/utils/schoolDate";
import sidebarList from "@/utils/sidebarList";
import LeavePage from "./LeavePage";
import MyAttendancePage from "./MyAttendancePage";

const get = vi.fn();
const post = vi.fn();
vi.mock("@/lib/authSession", () => ({ getStoredUser: () => ({ id: "me", session_mode: "organization", access_token: "token" }), clearAuthSession: vi.fn() }));
vi.mock("@/lib/axios", () => ({
  default: {
    get: (...args: unknown[]) => get(...args),
    post: (...args: unknown[]) => post(...args),
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/leave" }));

const ok = <T,>(payload: T) => Promise.resolve({ data: { payload } });
const failWith = (status: number, code: string, details?: unknown) => Promise.reject({ response: { status, data: { code, message: code, details } } });

const leave = (extra: Partial<LeaveRequest> = {}): LeaveRequest => ({
  id: "l1",
  person: { id: "me", full_name: "Rahim" },
  person_type: "STUDENT",
  class_name: "Class 8 A",
  from_date: "2026-11-07",
  to_date: "2026-11-08",
  school_days: 2,
  reason: "Fever",
  file: null,
  status: "PENDING",
  applied_by: { id: "me", full_name: "Rahim" },
  decided_by: null,
  decided_at: null,
  decision_note: null,
  cancelled_by: null,
  cancelled_at: null,
  created_at: "2026-11-05T04:00:00.000Z",
  can_decide: false,
  can_cancel: true,
  ...extra,
});
const MINE = (extra: Partial<MyLeave> = {}): MyLeave => ({
  today: "2026-11-05",
  can_apply: true,
  person_type: "STUDENT",
  can_apply_for_others: false,
  can_approve: false,
  requests: [],
  ...extra,
});

const serve = (mine: MyLeave, approvals: LeaveRequest[] = [], people: LeavePeople = { students: [], staff: [] }) =>
  get.mockImplementation((url: string) => {
    if (url.endsWith("/attendance/leave/mine")) return ok(mine);
    if (url.endsWith("/attendance/leave/approvals")) return ok(approvals);
    if (url.endsWith("/attendance/leave/people")) return ok(people);
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

/** Fills a date picker by its label (the design-system DatePicker is a date input). */
const pickDate = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label, { exact: false }), { target: { value } });

describe("leave page (ATT-09, ATT-11)", () => {
  it("applies for the student's own leave with dates and a reason", async () => {
    serve(MINE());
    post.mockImplementation(() => ok(leave()));
    renderApp(<LeavePage />);

    expect(await screen.findByText("No leave yet")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Apply for leave" })[0]);
    const drawer = await screen.findByRole("dialog", { name: "Apply for leave" });
    // A student applies only for themselves: no "who" choice.
    expect(within(drawer).queryByText("Who is on leave")).toBeNull();

    fireEvent.click(within(drawer).getByRole("button", { name: "Apply" }));
    expect((await within(drawer).findByRole("alert")).textContent).toBe("Choose a first and a last day, in order.");

    pickDate("First day", "2026-11-07");
    pickDate("Last day", "2026-11-08");
    fireEvent.click(within(drawer).getByRole("button", { name: "Apply" }));
    expect((await within(drawer).findByRole("alert")).textContent).toBe("Write a reason (at least 3 letters).");

    fireEvent.change(within(drawer).getByLabelText("Reason", { exact: false }), { target: { value: "Fever" } });
    fireEvent.click(within(drawer).getByRole("button", { name: "Apply" }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(expect.stringMatching(/\/attendance\/leave$/), { from_date: "2026-11-07", to_date: "2026-11-08", reason: "Fever" }),
    );
    expect(await screen.findByText("Leave applied for. You'll be told when it's answered.")).toBeTruthy();
  });

  it("explains the server's answer, such as an overlap with another request", async () => {
    serve(MINE());
    post.mockImplementation(() => failWith(409, "ATTENDANCE_LEAVE_OVERLAP", { from_date: "2026-11-08", to_date: "2026-11-10" }));
    renderApp(<LeavePage />);
    fireEvent.click((await screen.findAllByRole("button", { name: "Apply for leave" }))[0]);
    const drawer = await screen.findByRole("dialog", { name: "Apply for leave" });
    pickDate("First day", "2026-11-09");
    fireEvent.change(within(drawer).getByLabelText("Reason", { exact: false }), { target: { value: "Wedding" } });
    fireEvent.click(within(drawer).getByRole("button", { name: "Apply" }));
    expect((await within(drawer).findByRole("alert")).textContent).toBe("This overlaps another leave request (8 Nov – 10 Nov).");
    expect(post).toHaveBeenCalledWith(expect.anything(), { from_date: "2026-11-09", to_date: "2026-11-09", reason: "Wedding" });
  });

  it("lists my leave with its answer and withdraws a waiting request after asking", async () => {
    serve(
      MINE({
        requests: [
          leave(),
          leave({ id: "l2", from_date: "2026-10-20", to_date: "2026-10-20", school_days: 1, status: "REJECTED", can_cancel: false, decided_by: { id: "t1", full_name: "Rina" }, decision_note: "Exam day" }),
        ],
      }),
    );
    post.mockImplementation(() => ok(leave({ status: "CANCELLED", can_cancel: false })));
    renderApp(<LeavePage />);

    const table = await screen.findByRole("table", { name: "My leave" });
    expect(within(table).getByText("Waiting")).toBeTruthy();
    expect(within(table).getByText("Not approved")).toBeTruthy();
    expect(within(table).getByText("Rina: Exam day")).toBeTruthy();
    expect(within(table).getAllByRole("button", { name: /^Withdraw leave/ })).toHaveLength(1);

    fireEvent.click(within(table).getByRole("button", { name: /^Withdraw leave/ }));
    const confirm = await screen.findByRole("dialog", { name: "Withdraw this leave?" });
    fireEvent.click(within(confirm).getByRole("button", { name: "Withdraw" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith(expect.stringMatching(/\/attendance\/leave\/l1\/cancel$/), {}));
  });

  it("lets an approver approve with an optional comment and requires one to say no", async () => {
    const waiting = leave({ person: { id: "s1", full_name: "Karim" }, applied_by: { id: "s1", full_name: "Karim" }, can_decide: true, can_cancel: true });
    serve(MINE({ person_type: "TEACHER", can_apply_for_others: true, can_approve: true }), [waiting]);
    post.mockImplementation(() => ok(waiting));
    renderApp(<LeavePage />);

    fireEvent.click(await screen.findByRole("tab", { name: /To approve/ }));
    const list = await screen.findByRole("list", { name: "To approve" });
    expect(within(list).getByText("Karim")).toBeTruthy();
    expect(within(list).getByText("Class 8 A")).toBeTruthy();

    fireEvent.click(within(list).getByRole("button", { name: "Don't approve leave for Karim" }));
    let modal = await screen.findByRole("dialog", { name: "Don't approve leave for Karim?" });
    fireEvent.click(within(modal).getByRole("button", { name: "Don't approve" }));
    expect((await within(modal).findByRole("alert")).textContent).toBe("Say why, so they know what to do.");
    expect(post).not.toHaveBeenCalled();
    fireEvent.click(within(modal).getByRole("button", { name: "Cancel" }));

    fireEvent.click(within(list).getByRole("button", { name: "Approve leave for Karim" }));
    modal = await screen.findByRole("dialog", { name: "Approve leave for Karim?" });
    fireEvent.change(within(modal).getByLabelText("Comment for Karim", { exact: false }), { target: { value: "Get well soon" } });
    fireEvent.click(within(modal).getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith(expect.stringMatching(/\/attendance\/leave\/l1\/approve$/), { note: "Get well soon" }));
    expect(await screen.findByText("Leave approved")).toBeTruthy();
  });

  it("lets staff apply for a student found by name", async () => {
    serve(MINE({ person_type: "TEACHER", can_apply_for_others: true, can_approve: true }), [], {
      students: [{ id: "s1", full_name: "Karim", class_name: "Class 8 A" }],
      staff: [],
    });
    post.mockImplementation(() => ok(leave({ status: "APPROVED" })));
    renderApp(<LeavePage />);
    fireEvent.click((await screen.findAllByRole("button", { name: "Apply for leave" }))[0]);
    const drawer = await screen.findByRole("dialog", { name: "Apply for leave" });
    fireEvent.click(within(drawer).getByRole("radio", { name: "A student or teacher" }));
    fireEvent.change(within(drawer).getByLabelText("Search by name", { exact: false }), { target: { value: "Kar" } });
    await waitFor(() => expect(get).toHaveBeenCalledWith(expect.stringMatching(/\/attendance\/leave\/people$/), { params: { q: "Kar" } }));
    const person = within(drawer).getByLabelText("Person", { exact: false });
    await waitFor(() => expect(within(person).getByRole("option", { name: "Karim (Class 8 A)" })).toBeTruthy());
    fireEvent.change(person, { target: { value: "s1" } });
    pickDate("First day", "2026-11-07");
    fireEvent.change(within(drawer).getByLabelText("Reason", { exact: false }), { target: { value: "His mother called" } });
    fireEvent.click(within(drawer).getByRole("button", { name: "Apply" }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(expect.anything(), { from_date: "2026-11-07", to_date: "2026-11-07", reason: "His mother called", person_id: "s1" }),
    );
    expect(await screen.findByText("Leave saved and approved.")).toBeTruthy();
  });

  it("speaks Bangla", async () => {
    serve(MINE({ requests: [leave({ status: "APPROVED", can_cancel: false })] }));
    renderApp(<LeavePage />, { locale: "bn" });
    expect(await screen.findByRole("heading", { name: "ছুটি" })).toBeTruthy();
    expect(within(await screen.findByRole("table", { name: "আমার ছুটি" })).getByText("মঞ্জুর")).toBeTruthy();
  });

  it("says on My attendance when today is a day of leave, and links to Leave", async () => {
    get.mockImplementation((url: string) => {
      if (url.endsWith("/attendance/me/today")) return ok({ date: "2026-11-07", server_time: "2026-11-07T04:00:00.000Z", time_zone: "Asia/Dhaka", closed: null, on_leave: true, classes: [] });
      if (url.endsWith("/attendance/me/calendar")) return ok({ month: "2026-11", today: "2026-11-07", time_zone: "Asia/Dhaka", days: [], counts: { present: 0, late: 0, absent: 0, leave: 0 }, attendance_pct: null });
      return Promise.reject(new Error(`unexpected GET ${url}`));
    });
    renderApp(<MyAttendancePage />);
    expect(await screen.findByText("You're on approved leave today. Your classes count as Leave unless you check in.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Leave" }).getAttribute("href")).toBe("/leave");
  });

  it("puts Leave in the student menu, for every staff role and in a solo teacher's workspace, behind the attendance feature", () => {
    const items = sidebarList.filter((item) => item.route === "/leave");
    expect(items).toEqual([
      expect.objectContaining({ category: "Platform", role: ["STUDENT"], feature: "attendance" }),
      expect.objectContaining({ category: "Platform", role: ["TEACHER"], personalWorkspaceOnly: true, feature: "attendance" }),
      expect.objectContaining({ category: "Organization", memberRoles: ["OWNER", "ADMIN", "ASSISTANT", "TEACHER"], feature: "attendance" }),
    ]);
    expect(addDays("2026-11-05", -30)).toBe("2026-10-06");
  });
});
