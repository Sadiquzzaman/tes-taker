import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/i18n/test-utils";
import sidebarList from "@/utils/sidebarList";
import AttendanceSettingsPage from "./AttendanceSettingsPage";
import BranchesPage from "./BranchesPage";
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
  late_grace_minutes: 10,
  weekly_off_days: [5],
  guardian_sms: { late: true, absent: true, leave: true },
  repeat_absence_days: 3,
};

/** The desktop table (the Table also renders a card per row for phones). */
const table = () => within(screen.getByRole("table"));

const MAIN: Branch = { id: "b-main", name: null, address: null, geo_lat: null, geo_lng: null, checkin_radius_m: 100, is_default: true, section_count: 3 };
const FARMGATE: Branch = {
  id: "b-farmgate",
  name: "Farmgate",
  address: "Green Road",
  geo_lat: 23.7577,
  geo_lng: 90.3897,
  checkin_radius_m: 150,
  is_default: false,
  section_count: 2,
};

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

describe("attendance settings page (ATT-01, ATT-15)", () => {
  it("shows the grace period, off days, alerts and the main branch's pin, without the old presence and roll-call choices", async () => {
    serve({ "/attendance/settings": DEFAULTS, "/attendance/branches": [MAIN] });
    renderApp(<AttendanceSettingsPage />);

    expect(((await screen.findByLabelText(/Late after/)) as HTMLInputElement).value).toBe("10");
    expect(screen.getByRole("checkbox", { name: "Friday" })).toHaveProperty("checked", true);
    expect((screen.getByLabelText(/Check-in radius/) as HTMLInputElement).value).toBe("100");
    expect(screen.getByText("No pin yet. In-person check-in needs one.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Add branches" }).getAttribute("href")).toBe("/attendance-branches");
    expect(screen.queryByText(/Daily presence|Website check-in|entry time|roll call/i)).toBeNull();
  });

  it("saves the settings and the pin pasted from a Google Maps link", async () => {
    serve({ "/attendance/settings": DEFAULTS, "/attendance/branches": [MAIN] });
    patch.mockImplementation((url: string, body: unknown) =>
      url.endsWith("/attendance/settings") ? ok({ ...DEFAULTS, ...(body as object) }) : ok({ ...MAIN, ...(body as object) }),
    );
    renderApp(<AttendanceSettingsPage />);

    fireEvent.change(await screen.findByLabelText(/Late after/), { target: { value: "15" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Saturday" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Late" }));
    fireEvent.change(screen.getByLabelText(/Google Maps link/), { target: { value: "https://www.google.com/maps/@23.8103,90.4125,15z" } });
    expect((screen.getByLabelText("Latitude") as HTMLInputElement).value).toBe("23.8103");
    expect(screen.getByRole("link", { name: "Check the pin on Google Maps" }).getAttribute("href")).toBe("https://www.google.com/maps?q=23.8103,90.4125");
    fireEvent.change(screen.getByLabelText(/Check-in radius/), { target: { value: "200" } });
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

    await waitFor(() => expect(patch).toHaveBeenCalledTimes(2));
    expect(patch).toHaveBeenCalledWith(expect.stringMatching(/\/attendance\/settings$/), {
      late_grace_minutes: 15,
      weekly_off_days: [5, 6],
      guardian_sms: { late: false, absent: true, leave: true },
      repeat_absence_days: 3,
    });
    expect(patch).toHaveBeenCalledWith(expect.stringMatching(/\/attendance\/branches\/b-main$/), {
      geo_lat: 23.8103,
      geo_lng: 90.4125,
      checkin_radius_m: 200,
    });
    expect(await screen.findByText("Attendance settings saved")).toBeTruthy();
  });

  it("does not touch the pin when only the settings changed", async () => {
    serve({ "/attendance/settings": DEFAULTS, "/attendance/branches": [{ ...MAIN, geo_lat: 23.75, geo_lng: 90.38 }] });
    patch.mockReturnValue(ok({ ...DEFAULTS, repeat_absence_days: 4 }));
    renderApp(<AttendanceSettingsPage />);

    fireEvent.change(await screen.findByLabelText("Alert the class teacher after"), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1));
    expect(patch.mock.calls[0][0]).toMatch(/\/attendance\/settings$/);
  });

  it("checks the grace period, school days, alert days and the pin before saving", async () => {
    serve({ "/attendance/settings": { ...DEFAULTS, weekly_off_days: [1, 2, 3, 4, 5, 6] }, "/attendance/branches": [MAIN] });
    renderApp(<AttendanceSettingsPage />);
    const save = async () => screen.getByRole("button", { name: "Save settings" });

    fireEvent.click(await screen.findByRole("checkbox", { name: "Sunday" }));
    expect(screen.getByText("Leave at least one school day in the week.")).toBeTruthy();
    expect(await save()).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByRole("checkbox", { name: "Sunday" }));
    expect(await save()).toHaveProperty("disabled", false);

    fireEvent.change(screen.getByLabelText(/Late after/), { target: { value: "61" } });
    expect(screen.getByText("Enter a whole number from 0 to 60.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Late after/), { target: { value: "0" } });

    fireEvent.change(screen.getByLabelText("Alert the class teacher after"), { target: { value: "1" } });
    expect(screen.getByText("Enter a whole number from 2 to 30.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Alert the class teacher after"), { target: { value: "3" } });

    fireEvent.change(screen.getByLabelText("Latitude"), { target: { value: "23.75" } });
    expect(screen.getByText("Enter both latitude and longitude.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Check-in radius/), { target: { value: "10" } });
    expect(screen.getByText("Enter a whole number from 25 to 1,000.")).toBeTruthy();
    expect(await save()).toHaveProperty("disabled", true);
    expect(patch).not.toHaveBeenCalled();
  });

  it("fills the pin from this device's location", async () => {
    serve({ "/attendance/settings": DEFAULTS, "/attendance/branches": [MAIN] });
    const getCurrentPosition = vi.fn((done: PositionCallback) =>
      done({ coords: { latitude: 23.7577123, longitude: 90.3897456, accuracy: 18.4 } } as GeolocationPosition),
    );
    vi.stubGlobal("navigator", { ...navigator, geolocation: { getCurrentPosition } });
    renderApp(<AttendanceSettingsPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Use my current location" }));
    expect((screen.getByLabelText("Latitude") as HTMLInputElement).value).toBe("23.757712");
    expect((screen.getByLabelText("Longitude") as HTMLInputElement).value).toBe("90.389746");
    expect(screen.getByText("Location found (accurate to about 18 m).")).toBeTruthy();
    vi.unstubAllGlobals();
  });

  it("lists the branches instead of one pin once the organisation has several", async () => {
    serve({ "/attendance/settings": DEFAULTS, "/attendance/branches": [MAIN, FARMGATE] });
    renderApp(<AttendanceSettingsPage />);

    expect(await screen.findByText("2 branches, each with its own pin")).toBeTruthy();
    expect(screen.getByText("Main branch")).toBeTruthy();
    expect(screen.getByText("Within 150 m")).toBeTruthy();
    expect(screen.queryByLabelText("Latitude")).toBeNull();
    expect(screen.getByRole("link", { name: "Manage branches" })).toBeTruthy();
  });

  it("shows teachers the settings read-only", async () => {
    asRole("TEACHER");
    serve({ "/attendance/settings": DEFAULTS, "/attendance/branches": [MAIN] });
    renderApp(<AttendanceSettingsPage />);

    expect(await screen.findByText("Only the owner and admins can change these settings.")).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: "Friday" })).toHaveProperty("disabled", true);
    expect(screen.getByLabelText(/Late after/)).toHaveProperty("disabled", true);
    expect(screen.getByLabelText("Latitude")).toHaveProperty("disabled", true);
    expect(screen.queryByRole("button", { name: "Use my current location" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Save settings" })).toBeNull();
  });

  it("gives a solo teacher one pin and no branches", async () => {
    asSoloTeacher();
    serve({ "/attendance/settings": DEFAULTS, "/attendance/branches": [MAIN] });
    renderApp(<AttendanceSettingsPage />);

    expect(await screen.findByLabelText("Latitude")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Add branches" })).toBeNull();
    expect(screen.getByText(/Online classes can check in from anywhere/)).toBeTruthy();
  });

  it("reads in Bangla", async () => {
    serve({ "/attendance/settings": DEFAULTS, "/attendance/branches": [MAIN] });
    renderApp(<AttendanceSettingsPage />, { locale: "bn" });
    // The header shows while the settings load; wait for the loaded cards.
    expect(await screen.findByText("চেক-ইনের জায়গা")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "উপস্থিতির সেটিংস" })).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: "শুক্রবার" })).toHaveProperty("checked", true);
    expect(screen.getByRole("button", { name: "আমার এখনকার লোকেশন নিন" })).toBeTruthy();
  });
});

describe("branches page (ATT-15)", () => {
  it("lists the main branch first with pins, radius and sections", async () => {
    serve({ "/attendance/branches": [MAIN, FARMGATE] });
    renderApp(<BranchesPage />);

    await screen.findByRole("table");
    const rows = table().getAllByRole("row").slice(1);
    expect(within(rows[0]).getByText("Main branch")).toBeTruthy();
    expect(within(rows[0]).getByText("Main")).toBeTruthy();
    expect(within(rows[0]).getByText("No pin yet")).toBeTruthy();
    expect(within(rows[1]).getByText("Within 150 m")).toBeTruthy();
    // The main branch can be edited but not removed.
    expect(table().queryByRole("button", { name: "Remove Main branch" })).toBeNull();
    expect(table().getByRole("button", { name: "Remove Farmgate" })).toBeTruthy();
  });

  it("adds a branch with a pin, taking the main branch's radius", async () => {
    serve({ "/attendance/branches": [{ ...MAIN, checkin_radius_m: 300 }] });
    post.mockReturnValue(ok(FARMGATE));
    renderApp(<BranchesPage />);

    expect(await screen.findByText(/You have one location/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add branch" }));
    const drawer = within(await screen.findByRole("dialog", { name: "Add a branch" }));
    expect((drawer.getByLabelText(/Check-in radius/) as HTMLInputElement).value).toBe("300");
    fireEvent.change(drawer.getByLabelText(/^Name/), { target: { value: " Farmgate " } });
    fireEvent.change(drawer.getByLabelText(/Google Maps link/), { target: { value: "https://maps.google.com/?q=23.7577,90.3897" } });
    fireEvent.click(drawer.getByRole("button", { name: "Add branch" }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(expect.stringMatching(/\/attendance\/branches$/), {
        name: "Farmgate",
        address: null,
        geo_lat: 23.7577,
        geo_lng: 90.3897,
        checkin_radius_m: 300,
      }),
    );
    expect(await screen.findByText("Branch added")).toBeTruthy();
  });

  it("needs a name for a new branch and shows the API's reason when one is refused", async () => {
    serve({ "/attendance/branches": [MAIN, FARMGATE] });
    post.mockImplementation(() => failWith(409, "ATTENDANCE_BRANCH_NAME_TAKEN"));
    renderApp(<BranchesPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Add branch" }));
    const drawer = within(await screen.findByRole("dialog", { name: "Add a branch" }));
    fireEvent.click(drawer.getByRole("button", { name: "Add branch" }));
    expect(await drawer.findByText("Enter a name for the branch.")).toBeTruthy();
    expect(post).not.toHaveBeenCalled();

    fireEvent.change(drawer.getByLabelText(/^Name/), { target: { value: "farmgate" } });
    fireEvent.click(drawer.getByRole("button", { name: "Add branch" }));
    expect(await drawer.findByText("Another branch already has this name.")).toBeTruthy();
  });

  it("explains why a branch still in use cannot be removed", async () => {
    serve({ "/attendance/branches": [MAIN, FARMGATE] });
    del.mockImplementation(() => failWith(409, "ATTENDANCE_BRANCH_IN_USE"));
    renderApp(<BranchesPage />);

    await screen.findByRole("table");
    fireEvent.click(table().getByRole("button", { name: "Remove Farmgate" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Remove this branch?" }));
    expect(dialog.getByText(/Its record and past attendance are kept/)).toBeTruthy();
    fireEvent.click(dialog.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(del).toHaveBeenCalledWith(expect.stringMatching(/\/attendance\/branches\/b-farmgate$/)));
    expect(await dialog.findByText(/still meet here. Move them to another branch first/)).toBeTruthy();
  });

  it("shows teachers the branches without changes", async () => {
    asRole("TEACHER");
    serve({ "/attendance/branches": [MAIN, FARMGATE] });
    renderApp(<BranchesPage />);
    await screen.findByRole("table");
    expect(screen.queryByRole("button", { name: "Add branch" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Edit/ })).toBeNull();
  });

  it("reads in Bangla", async () => {
    serve({ "/attendance/branches": [MAIN, FARMGATE] });
    renderApp(<BranchesPage />, { locale: "bn" });
    await screen.findByRole("table");
    expect(screen.getByRole("heading", { name: "শাখা" })).toBeTruthy();
    expect(table().getByText("প্রধান শাখা")).toBeTruthy();
    expect(table().getByText("১৫০ মিটারের মধ্যে")).toBeTruthy();
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
    post.mockImplementation(() => failWith(400, "HOLIDAY_RANGE_TOO_LONG"));
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
  it("shows attendance settings, branches and holidays to owners, admins and solo teachers, only with the attendance feature", () => {
    const items = sidebarList.filter((item) => item.route === "/attendance-settings" || item.route === "/holidays");
    expect(items).toHaveLength(4);
    const branches = sidebarList.filter((item) => item.route === "/attendance-branches");
    // Branches are for organisations; a solo teacher sets their one pin in the settings.
    expect(branches).toHaveLength(1);
    expect(branches[0]).toMatchObject({ category: "Organization", memberRoles: ["OWNER", "ADMIN"], feature: "attendance" });
    expect(items.every((item) => item.feature === "attendance")).toBe(true);
    expect(items.filter((item) => item.category === "Organization").every((item) => item.memberRoles?.join() === "OWNER,ADMIN")).toBe(true);
    expect(items.filter((item) => item.category === "Platform").every((item) => item.personalWorkspaceOnly)).toBe(true);
  });
});
