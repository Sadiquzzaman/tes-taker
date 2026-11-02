import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/i18n/test-utils";
import sidebarList from "@/utils/sidebarList";
import AttendanceSettingsPage from "./AttendanceSettingsPage";
import HolidaysPage from "./HolidaysPage";

const get = vi.fn();
const patch = vi.fn();
const post = vi.fn();
const del = vi.fn();
const workspace = vi.fn();
const storedUser = vi.fn();
vi.mock("@/lib/authSession", () => ({ getStoredUser: () => storedUser(), clearAuthSession: vi.fn() }));
vi.mock("@/lib/axios", () => ({
  default: {
    get: (...args: unknown[]) => get(...args),
    patch: (...args: unknown[]) => patch(...args),
    post: (...args: unknown[]) => post(...args),
    delete: (...args: unknown[]) => del(...args),
  },
}));
vi.mock("@/hooks/organization/useWorkspace", () => ({ default: () => workspace() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/holidays" }));

const ok = <T,>(payload: T) => Promise.resolve({ data: { payload } });
const failWith = (status: number, code: string) => Promise.reject({ response: { status, data: { code, message: code } } });

const DEFAULTS: AttendanceSettings = {
  attendance_method: "OFF",
  selfie_required: false,
  class_attendance_mode: "PER_SESSION",
  weekly_off_days: [5],
  student_entry_time: "09:00",
  teacher_entry_time: "08:45",
  guardian_sms: { late: true, absent: true, leave: true },
  repeat_absence_days: 3,
};

/** The desktop table (the Table also renders a card per row for phones). */
const table = () => within(screen.getByRole("table"));
const presence = () => within(screen.getByRole("group", { name: "How do people check in?" }));

const asRole = (role: OrganizationMemberRole) =>
  workspace.mockReturnValue({
    workspace: { type: "organization", id: "org-1" },
    isIndividual: false,
    organizationId: "org-1",
    activeOrganization: { id: "org-1", name: "Green School", status: "approved", role },
  });

const asSoloTeacher = () => {
  workspace.mockReturnValue({ workspace: { type: "personal" }, isIndividual: true, organizationId: null, activeOrganization: null });
  storedUser.mockReturnValue({ session_mode: "personal", personal_teacher_enabled: true, access_token: "token" });
};

/** Answers GETs by path suffix (CI sets NEXT_PUBLIC_BASE_URL, so the prefix differs). */
const serve = (routes: Record<string, unknown>) =>
  get.mockImplementation((url: string) => {
    const match = Object.keys(routes).find((path) => url.endsWith(path));
    return match ? ok(routes[match]) : Promise.reject(new Error(`unexpected GET ${url}`));
  });

beforeEach(() => {
  vi.clearAllMocks();
  // 2 Nov 2026, 10:00 in Dhaka.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-02T04:00:00Z"));
  asRole("OWNER");
  storedUser.mockReturnValue({ session_mode: "organization", access_token: "token" });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("attendance settings page (ATT-01)", () => {
  it("shows the settings, offers Off and Website check-in, and marks ZKTeco and the app as coming soon", async () => {
    serve({ "/attendance/settings": DEFAULTS });
    renderApp(<AttendanceSettingsPage />);

    await screen.findByRole("group", { name: "How do people check in?" });
    expect(presence().getByRole("radio", { name: "Off" })).toHaveProperty("checked", true);
    expect(screen.getByRole("radio", { name: "Website check-in" })).toHaveProperty("disabled", false);
    expect(screen.getByRole("radio", { name: /ZKTeco machine/ })).toHaveProperty("disabled", true);
    expect(screen.getByRole("radio", { name: /Mobile app/ })).toHaveProperty("disabled", true);
    expect(screen.getAllByText("Coming soon")).toHaveLength(2);
    expect(screen.getByRole("radio", { name: "Every class" })).toHaveProperty("checked", true);
    expect(screen.getByRole("checkbox", { name: "Friday" })).toHaveProperty("checked", true);
    expect((screen.getByLabelText(/Students' entry time/) as HTMLInputElement).value).toBe("09:00");
  });

  it("saves the owner's choices", async () => {
    serve({ "/attendance/settings": DEFAULTS });
    const saved = { ...DEFAULTS, attendance_method: "WEB", weekly_off_days: [5, 6], guardian_sms: { late: false, absent: true, leave: true } };
    patch.mockReturnValue(ok(saved));
    renderApp(<AttendanceSettingsPage />);

    fireEvent.click(await screen.findByRole("radio", { name: "Website check-in" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Saturday" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Late" }));
    fireEvent.change(screen.getByLabelText(/Students' entry time/), { target: { value: "08:30" } });
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith(expect.stringMatching(/\/attendance\/settings$/), {
        attendance_method: "WEB",
        class_attendance_mode: "PER_SESSION",
        weekly_off_days: [5, 6],
        student_entry_time: "08:30",
        teacher_entry_time: "08:45",
        guardian_sms: { late: false, absent: true, leave: true },
        repeat_absence_days: 3,
      }),
    );
    expect(await screen.findByText("Attendance settings saved")).toBeTruthy();
  });

  it("asks before switching the method while a session is running, then saves with the confirmation", async () => {
    serve({ "/attendance/settings": { ...DEFAULTS, attendance_method: "WEB" } });
    patch.mockReturnValueOnce(failWith(409, "ATTENDANCE_METHOD_CHANGE_CONFIRM")).mockReturnValueOnce(ok(DEFAULTS));
    renderApp(<AttendanceSettingsPage />);

    await screen.findByRole("group", { name: "How do people check in?" });
    fireEvent.click(presence().getByRole("radio", { name: "Off" }));
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

    const dialog = await screen.findByRole("dialog", { name: "Switch the daily presence method?" });
    expect(within(dialog).getByText(/Switching from Website check-in to Off/)).toBeTruthy();
    expect(within(dialog).getByText(/Attendance already saved is kept/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Switch method" }));

    await waitFor(() => expect(patch).toHaveBeenCalledTimes(2));
    expect(patch.mock.calls[1][1]).toMatchObject({ attendance_method: "OFF", confirm_method_change: true });
  });

  it("keeps at least one school day and checks the alert days before saving", async () => {
    serve({ "/attendance/settings": { ...DEFAULTS, weekly_off_days: [1, 2, 3, 4, 5, 6] } });
    renderApp(<AttendanceSettingsPage />);

    fireEvent.click(await screen.findByRole("checkbox", { name: "Sunday" }));
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));
    expect(await screen.findByText("Leave at least one school day in the week.")).toBeTruthy();
    expect(patch).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Alert the class teacher after"), { target: { value: "1" } });
    expect(screen.getByText("Enter a whole number from 2 to 30.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save settings" })).toHaveProperty("disabled", true);
  });

  it("shows teachers the settings read-only", async () => {
    asRole("TEACHER");
    serve({ "/attendance/settings": DEFAULTS });
    renderApp(<AttendanceSettingsPage />);

    expect(await screen.findByText("Only the owner and admins can change these settings.")).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Website check-in" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("checkbox", { name: "Friday" })).toHaveProperty("disabled", true);
    expect(screen.queryByRole("button", { name: "Save settings" })).toBeNull();
  });

  it("gives a solo teacher class attendance only, without a presence method", async () => {
    asSoloTeacher();
    serve({ "/attendance/settings": DEFAULTS });
    patch.mockReturnValue(ok({ ...DEFAULTS, class_attendance_mode: "DAILY" }));
    renderApp(<AttendanceSettingsPage />);

    expect(await screen.findByText(/Your workspace takes class attendance only/)).toBeTruthy();
    expect(screen.queryByRole("radio", { name: "Website check-in" })).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: "Once a day" }));
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));
    await waitFor(() => expect(patch).toHaveBeenCalled());
    expect(patch.mock.calls[0][1]).not.toHaveProperty("attendance_method");
    expect(patch.mock.calls[0][1]).toMatchObject({ class_attendance_mode: "DAILY" });
  });

  it("reads in Bangla", async () => {
    serve({ "/attendance/settings": DEFAULTS });
    renderApp(<AttendanceSettingsPage />, { locale: "bn" });
    expect(await screen.findByRole("heading", { name: "উপস্থিতির সেটিংস" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "ওয়েবসাইটে চেক-ইন" })).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: "শুক্রবার" })).toHaveProperty("checked", true);
    expect(screen.getAllByText("শীঘ্রই আসছে")).toHaveLength(2);
  });
});

describe("holidays page (CAL-04)", () => {
  const HOLIDAYS: Holiday[] = [
    { id: "h-past", date_from: "2026-03-26", date_to: "2026-03-26", name: "Independence Day", days: 1 },
    { id: "h-now", date_from: "2026-11-01", date_to: "2026-11-03", name: "Autumn break", days: 3 },
    { id: "h-next", date_from: "2026-12-16", date_to: "2026-12-16", name: "Victory Day", days: 1 },
  ];

  it("lists the year's holidays with their status; only upcoming ones can be changed", async () => {
    serve({ "/holidays": HOLIDAYS, "/attendance/settings": { ...DEFAULTS, weekly_off_days: [5, 6] } });
    renderApp(<HolidaysPage />);

    expect((await screen.findAllByText("Victory Day")).length).toBeGreaterThan(0);
    expect(get).toHaveBeenCalledWith(expect.stringMatching(/\/holidays$/), { params: { from: "2026-01-01", to: "2026-12-31" } });
    expect(table().getByText("Past")).toBeTruthy();
    expect(table().getByText("Ongoing")).toBeTruthy();
    expect(table().getByText("Upcoming")).toBeTruthy();
    expect(table().getAllByText("Can't be changed")).toHaveLength(2);
    expect(table().getAllByRole("button", { name: /^Edit holiday on/ })).toHaveLength(1);
    expect(screen.getByText("3 holidays, 5 days in all")).toBeTruthy();
    expect(screen.getByTestId("off-days").textContent).toContain("Weekly off days: Saturday, Friday.");
  });

  it("adds a single day: the last day is the first day", async () => {
    serve({ "/holidays": [], "/attendance/settings": DEFAULTS });
    post.mockReturnValue(ok(HOLIDAYS[2]));
    renderApp(<HolidaysPage />);

    expect(await screen.findByText("No holidays in 2026 yet")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Add holiday" })[0]);
    const drawer = await screen.findByRole("dialog", { name: "Add holiday" });
    fireEvent.change(within(drawer).getByLabelText(/First day/), { target: { value: "2026-12-16" } });
    fireEvent.change(within(drawer).getByLabelText("Note (optional)"), { target: { value: " Victory Day " } });
    fireEvent.click(within(drawer).getByRole("button", { name: "Add holiday" }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(expect.stringMatching(/\/holidays$/), { date_from: "2026-12-16", date_to: "2026-12-16", name: "Victory Day" }),
    );
    expect(await screen.findByText("Holiday added")).toBeTruthy();
  });

  it("checks the dates before sending, and shows the server's reason", async () => {
    serve({ "/holidays": [], "/attendance/settings": DEFAULTS });
    post.mockReturnValue(failWith(400, "HOLIDAY_RANGE_TOO_LONG"));
    renderApp(<HolidaysPage />);

    fireEvent.click((await screen.findAllByRole("button", { name: "Add holiday" }))[0]);
    const drawer = await screen.findByRole("dialog", { name: "Add holiday" });
    const submit = within(drawer).getByRole("button", { name: "Add holiday" });

    fireEvent.change(within(drawer).getByLabelText(/First day/), { target: { value: "2026-10-30" } });
    fireEvent.click(submit);
    expect(await within(drawer).findByText("Past days can't be changed. Choose today or a later date.")).toBeTruthy();

    fireEvent.change(within(drawer).getByLabelText(/First day/), { target: { value: "2026-12-20" } });
    fireEvent.change(within(drawer).getByLabelText("Last day"), { target: { value: "2026-12-10" } });
    fireEvent.click(submit);
    expect(await within(drawer).findByText("The last day can't be before the first day.")).toBeTruthy();
    expect(post).not.toHaveBeenCalled();

    fireEvent.change(within(drawer).getByLabelText("Last day"), { target: { value: "2027-06-30" } });
    fireEvent.click(submit);
    expect(await within(drawer).findByText("A holiday can be at most 120 days long.")).toBeTruthy();
  });

  it("edits and removes an upcoming holiday after asking", async () => {
    serve({ "/holidays": HOLIDAYS, "/attendance/settings": DEFAULTS });
    patch.mockReturnValue(ok(HOLIDAYS[2]));
    del.mockReturnValue(ok(null));
    renderApp(<HolidaysPage />);

    await screen.findByRole("table");
    fireEvent.click(table().getByRole("button", { name: /^Edit holiday on/ }));
    const drawer = await screen.findByRole("dialog", { name: "Edit holiday" });
    expect((within(drawer).getByLabelText(/First day/) as HTMLInputElement).value).toBe("2026-12-16");
    expect((within(drawer).getByLabelText("Last day") as HTMLInputElement).value).toBe("");
    fireEvent.change(within(drawer).getByLabelText("Last day"), { target: { value: "2026-12-17" } });
    fireEvent.click(within(drawer).getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith(expect.stringMatching(/\/holidays\/h-next$/), { date_from: "2026-12-16", date_to: "2026-12-17", name: "Victory Day" }),
    );

    fireEvent.click(table().getByRole("button", { name: /^Remove holiday on/ }));
    const confirm = await screen.findByRole("dialog", { name: "Remove this holiday?" });
    expect(within(confirm).getByText(/will be a normal school day again/)).toBeTruthy();
    fireEvent.click(within(confirm).getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(del).toHaveBeenCalledWith(expect.stringMatching(/\/holidays\/h-next$/)));
  });

  it("lets teachers see the list without changing it", async () => {
    asRole("TEACHER");
    serve({ "/holidays": HOLIDAYS, "/attendance/settings": DEFAULTS });
    renderApp(<HolidaysPage />);
    expect((await screen.findAllByText("Victory Day")).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Add holiday" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Edit holiday on/ })).toBeNull();
    expect(screen.queryByRole("link", { name: "Change" })).toBeNull();
  });

  it("reads in Bangla with Bangla digits", async () => {
    serve({ "/holidays": HOLIDAYS, "/attendance/settings": DEFAULTS });
    renderApp(<HolidaysPage />, { locale: "bn" });
    expect(await screen.findByRole("heading", { name: "ছুটির দিন" })).toBeTruthy();
    expect(screen.getByText("২০২৬ সালের ছুটি")).toBeTruthy();
    expect(screen.getByText("৩টি ছুটি, মোট ৫ দিন")).toBeTruthy();
    expect(table().getByText("আসন্ন")).toBeTruthy();
  });
});

describe("menu", () => {
  it("shows attendance settings and holidays to owners, admins and solo teachers, only with the attendance feature", () => {
    const items = sidebarList.filter((item) => item.route === "/attendance-settings" || item.route === "/holidays");
    expect(items).toHaveLength(4);
    expect(items.every((item) => item.feature === "attendance")).toBe(true);
    expect(items.filter((item) => item.category === "Organization").every((item) => item.memberRoles?.join() === "OWNER,ADMIN")).toBe(true);
    expect(items.filter((item) => item.category === "Platform").every((item) => item.personalWorkspaceOnly)).toBe(true);
  });
});
