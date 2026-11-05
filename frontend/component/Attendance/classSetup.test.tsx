import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/i18n/test-utils";
import sidebarList from "@/utils/sidebarList";
import ClassSetupPage from "./ClassSetupPage";

const get = vi.fn();
const patch = vi.fn();
const post = vi.fn();
const put = vi.fn();
const workspace = vi.fn();
vi.mock("@/lib/authSession", () => ({ getStoredUser: () => ({ session_mode: "organization", access_token: "token" }), clearAuthSession: vi.fn() }));
vi.mock("@/lib/axios", () => ({
  default: {
    get: (...args: unknown[]) => get(...args),
    patch: (...args: unknown[]) => patch(...args),
    post: (...args: unknown[]) => post(...args),
    put: (...args: unknown[]) => put(...args),
  },
}));
vi.mock("@/hooks/organization/useWorkspace", () => ({ default: () => workspace() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/attendance-setup" }));

const ok = <T,>(payload: T) => Promise.resolve({ data: { payload } });
const failWith = (status: number, code: string, details?: unknown) =>
  Promise.reject({ response: { status, data: { code, message: code, details } } });

const MAIN: Branch = { id: "b-main", name: null, address: null, geo_lat: 23.75, geo_lng: 90.38, checkin_radius_m: 100, is_default: true, section_count: 3 };
const FARMGATE: Branch = { id: "b-fg", name: "Farmgate", address: null, geo_lat: null, geo_lng: null, checkin_radius_m: 100, is_default: false, section_count: 0 };

const slot = (id: string, day: number, start: string, end: string, teacher: ScheduleSlot["teacher"] = null): ScheduleSlot => ({
  id,
  day_of_week: day,
  start_time: start,
  end_time: end,
  teacher_id: teacher?.id ?? null,
  teacher,
});
const row = (id: string, className: string, name: string, extra: Partial<SectionSetup> = {}): SectionSetup => ({
  id,
  name,
  class: { id: `c-${className}`, name: className },
  shift: "MORNING",
  branch_id: "b-main",
  class_type: "IN_PERSON",
  mode: "SELF_CHECKIN",
  grace_minutes: null,
  slots: [],
  can_edit: true,
  ...extra,
});
const S6A = row("s6a", "Class 6", "A", {
  slots: [slot("x1", 1, "16:00", "17:30"), slot("x2", 3, "18:00", "19:00", { id: "t1", full_name: "Rina Akter" }), slot("x3", 6, "16:00", "17:30")],
});
const S6B = row("s6b", "Class 6", "B", { shift: "DAY" });
const S7A = row("s7a", "Class 7", "A");
const SETUP: ClassSetup = {
  session: { id: "ses-1", name: "2026", status: "ACTIVE" },
  late_grace_minutes: 10,
  main_branch_id: "b-main",
  can_manage: true,
  sections: [S6A, S6B, S7A],
};

const serve = (setup: ClassSetup = SETUP, branches: Branch[] = [MAIN]) =>
  get.mockImplementation((url: string) => {
    if (url.endsWith("/attendance/setup")) return ok(setup);
    if (url.endsWith("/attendance/branches")) return ok(branches);
    if (url.endsWith("/sessions")) return ok([{ id: "ses-1", name: "2026", start_date: "2026-01-01", end_date: "2026-12-31", status: "ACTIVE", is_default: true }]);
    if (url.endsWith("/assignable-teachers")) return ok([{ id: "m1", role: "TEACHER", user: { id: "t1", full_name: "Rina Akter", email: null, phone: null } }]);
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });

const table = () => within(screen.getByRole("table"));
const rowFor = (name: string) => table().getByText(name).closest("tr") as HTMLElement;

beforeEach(() => {
  vi.clearAllMocks();
  workspace.mockReturnValue({
    workspace: { type: "organization", id: "org-1" },
    isIndividual: false,
    organizationId: "org-1",
    activeOrganization: { id: "org-1", name: "Green School", status: "approved", role: "OWNER" },
  });
});

afterEach(cleanup);

describe("class setup page (ATT-16)", () => {
  it("lists every section with its schedule grouped by time, Saturday first, and flags those without one", async () => {
    serve();
    renderApp(<ClassSetupPage />);
    await screen.findByRole("table");
    const sixA = within(rowFor("Class 6 A"));
    expect(sixA.getByText("Sat, Mon")).toBeTruthy();
    expect(sixA.getByText("16:00–17:30")).toBeTruthy();
    expect(sixA.getByText("18:00–19:00 · Rina Akter")).toBeTruthy();
    expect(within(rowFor("Class 6 B")).getByText("No schedule yet")).toBeTruthy();
    expect(screen.getByText("2 sections have no schedule yet; no check-in opens for them.")).toBeTruthy();
    // One location: no branch column.
    expect(table().queryByRole("columnheader", { name: "Branch" })).toBeNull();
  });

  it("saves a section's class type, mode and grace period at once", async () => {
    serve();
    patch.mockImplementation((_url: string, body: Partial<SectionSetup>) => ok({ ...S6B, ...body }));
    renderApp(<ClassSetupPage />);
    await screen.findByRole("table");

    fireEvent.change(table().getByLabelText("Class type of Class 6 B"), { target: { value: "ONLINE" } });
    await waitFor(() => expect(patch).toHaveBeenCalledWith(expect.stringMatching(/\/attendance\/setup\/sections\/s6b$/), { class_type: "ONLINE" }));
    const grace = table().getByLabelText("Late after, Class 6 B") as HTMLSelectElement;
    expect(grace.options[0].text).toBe("Default (10 min)");
    fireEvent.change(grace, { target: { value: "5" } });
    await waitFor(() => expect(patch).toHaveBeenLastCalledWith(expect.stringMatching(/s6b$/), { grace_minutes: 5 }));
    fireEvent.change(table().getByLabelText("Late after, Class 6 B"), { target: { value: "" } });
    await waitFor(() => expect(patch).toHaveBeenLastCalledWith(expect.stringMatching(/s6b$/), { grace_minutes: null }));
    fireEvent.change(table().getByLabelText("Attendance mode of Class 6 B"), { target: { value: "PAPER_REGISTER" } });
    await waitFor(() => expect(patch).toHaveBeenLastCalledWith(expect.stringMatching(/s6b$/), { mode: "PAPER_REGISTER" }));
  });

  it("shows the branch column with several branches and warns when an in-person section's branch has no pin", async () => {
    serve({ ...SETUP, sections: [S6A, { ...S6B, branch_id: "b-fg" }, S7A] }, [MAIN, FARMGATE]);
    patch.mockImplementation((_url: string, body: Partial<SectionSetup>) => ok({ ...S7A, ...body }));
    renderApp(<ClassSetupPage />);
    await screen.findByRole("table");

    expect(within(rowFor("Class 6 B")).getByText("Its branch has no pin yet")).toBeTruthy();
    expect(within(rowFor("Class 6 A")).queryByText("Its branch has no pin yet")).toBeNull();
    fireEvent.change(table().getByLabelText("Branch of Class 7 A"), { target: { value: "b-fg" } });
    await waitFor(() => expect(patch).toHaveBeenCalledWith(expect.stringMatching(/s7a$/), { branch_id: "b-fg" }));
  });

  it("edits a schedule one line per time and saves it as weekly slots", async () => {
    serve();
    put.mockImplementation((_url: string, body: { slots: unknown[] }) => ok({ ...S7A, slots: [] , body }));
    renderApp(<ClassSetupPage />);
    await screen.findByRole("table");

    fireEvent.click(table().getByRole("button", { name: "Edit the schedule of Class 7 A" }));
    const drawer = within(await screen.findByRole("dialog", { name: "Schedule of Class 7 A" }));
    const first = within(drawer.getByRole("group", { name: "Time 1" }));
    fireEvent.click(first.getByRole("checkbox", { name: "Saturday" }));
    fireEvent.click(first.getByRole("checkbox", { name: "Monday" }));
    fireEvent.change(first.getByLabelText("Starts"), { target: { value: "16:00" } });
    fireEvent.change(first.getByLabelText("Ends"), { target: { value: "17:30" } });
    fireEvent.click(drawer.getByRole("button", { name: "Add another time" }));
    const second = within(drawer.getByRole("group", { name: "Time 2" }));
    fireEvent.click(second.getByRole("checkbox", { name: "Wednesday" }));
    fireEvent.change(second.getByLabelText("Starts"), { target: { value: "18:00" } });
    fireEvent.change(second.getByLabelText("Ends"), { target: { value: "19:00" } });
    fireEvent.change(second.getByLabelText(/Teacher/), { target: { value: "t1" } });
    fireEvent.click(drawer.getByRole("button", { name: "Save schedule" }));

    await waitFor(() =>
      expect(put).toHaveBeenCalledWith(expect.stringMatching(/\/attendance\/setup\/sections\/s7a\/slots$/), {
        slots: [
          { day_of_week: 6, start_time: "16:00", end_time: "17:30", teacher_id: null },
          { day_of_week: 1, start_time: "16:00", end_time: "17:30", teacher_id: null },
          { day_of_week: 3, start_time: "18:00", end_time: "19:00", teacher_id: "t1" },
        ],
      }),
    );
    expect(await screen.findByText("Schedule of Class 7 A saved")).toBeTruthy();
  });

  it("checks the lines before saving and points at the line the API refuses", async () => {
    serve();
    put.mockImplementation(() => failWith(409, "SCHEDULE_TEACHER_CLASH", { slot: 2, section: { name: "B", class_name: "Class 6" } }));
    renderApp(<ClassSetupPage />);
    await screen.findByRole("table");

    fireEvent.click(table().getByRole("button", { name: "Edit the schedule of Class 6 A" }));
    const drawer = within(await screen.findByRole("dialog", { name: "Schedule of Class 6 A" }));
    // Lines from the saved slots: Sat+Mon 16:00–17:30, Wed 18:00–19:00 with Rina.
    const second = within(drawer.getByRole("group", { name: "Time 2" }));
    expect(second.getByRole("checkbox", { name: "Wednesday" })).toHaveProperty("checked", true);
    expect((second.getByLabelText(/Teacher/) as HTMLSelectElement).value).toBe("t1");

    fireEvent.change(second.getByLabelText("Ends"), { target: { value: "17:00" } });
    fireEvent.click(drawer.getByRole("button", { name: "Save schedule" }));
    expect(await second.findByText("The end must be after the start.")).toBeTruthy();
    expect(put).not.toHaveBeenCalled();

    fireEvent.change(second.getByLabelText("Ends"), { target: { value: "19:00" } });
    fireEvent.click(drawer.getByRole("button", { name: "Save schedule" }));
    // Slot 2 of the request (Wednesday) belongs to the second line.
    expect(await second.findByText("This teacher already has a class at this time (Class 6 B).")).toBeTruthy();
  });

  it("copies another section's schedule from the drawer", async () => {
    serve();
    post.mockReturnValue(ok({ ...S7A, slots: S6A.slots.map((s) => ({ ...s, teacher: null, teacher_id: null })) }));
    renderApp(<ClassSetupPage />);
    await screen.findByRole("table");

    fireEvent.click(table().getByRole("button", { name: "Edit the schedule of Class 7 A" }));
    const drawer = within(await screen.findByRole("dialog", { name: "Schedule of Class 7 A" }));
    const source = drawer.getByLabelText("Copy from another section") as HTMLSelectElement;
    // Only sections that have a schedule can be copied.
    expect([...source.options].map((o) => o.text)).toEqual(["Choose a section", "Class 6 A"]);
    fireEvent.change(source, { target: { value: "s6a" } });
    fireEvent.click(drawer.getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith(expect.stringMatching(/\/sections\/s7a\/copy$/), { from_section_id: "s6a" }));
    expect(await screen.findByText("Schedule copied to Class 7 A")).toBeTruthy();
  });

  it("applies a schedule to the rest of a class or shift after a preview", async () => {
    serve();
    post.mockImplementation((_url: string, body: { dry_run: boolean; shift?: string }) =>
      ok({
        dry_run: body.dry_run,
        sections: body.shift
          ? [{ id: "s7a", name: "A", class_name: "Class 7", slots_before: 0, teachers_dropped: 0 }]
          : [{ id: "s6b", name: "B", class_name: "Class 6", slots_before: 2, teachers_dropped: 1 }],
      }),
    );
    renderApp(<ClassSetupPage />);
    await screen.findByRole("table");

    fireEvent.click(table().getByRole("button", { name: "Apply the schedule of Class 6 A to other sections" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Apply this schedule" }));
    expect(await dialog.findByText("1 section will get this schedule:")).toBeTruthy();
    expect(dialog.getByText("Class 6 B")).toBeTruthy();
    expect(dialog.getByText("replaces 2 times")).toBeTruthy();
    expect(dialog.getByText("1 time with a teacher will be replaced.")).toBeTruthy();
    expect(post).toHaveBeenCalledWith(expect.stringMatching(/\/attendance\/setup\/apply$/), {
      from_section_id: "s6a",
      class_id: "c-Class 6",
      include_settings: false,
      dry_run: true,
    });

    fireEvent.click(dialog.getByRole("radio", { name: "Every other section of the Morning shift" }));
    expect(await dialog.findByText("Class 7 A")).toBeTruthy();
    fireEvent.click(dialog.getByRole("checkbox", { name: /Also copy in person/ }));
    fireEvent.click(dialog.getByRole("button", { name: "Apply to 1 section" }));
    await waitFor(() =>
      expect(post).toHaveBeenLastCalledWith(expect.stringMatching(/\/apply$/), {
        from_section_id: "s6a",
        shift: "MORNING",
        include_settings: true,
        dry_run: false,
      }),
    );
    expect(await screen.findByText("Schedule applied to 1 section")).toBeTruthy();
  });

  it("lets a teacher change only the sections they teach, without applying to others", async () => {
    workspace.mockReturnValue({
      workspace: { type: "organization", id: "org-1" },
      isIndividual: false,
      organizationId: "org-1",
      activeOrganization: { id: "org-1", name: "Green School", status: "approved", role: "TEACHER" },
    });
    serve({ ...SETUP, can_manage: false, sections: [S6A, { ...S6B, can_edit: false }, { ...S7A, can_edit: false }] });
    renderApp(<ClassSetupPage />);
    await screen.findByRole("table");

    expect(table().getByLabelText("Class type of Class 6 A")).toHaveProperty("disabled", false);
    expect(table().getByLabelText("Class type of Class 6 B")).toHaveProperty("disabled", true);
    expect(table().queryByRole("button", { name: "Edit the schedule of Class 6 B" })).toBeNull();
    expect(table().queryByRole("button", { name: /^Apply the schedule/ })).toBeNull();
    // Teachers are not offered for slots (they keep the ones already set).
    expect(get).not.toHaveBeenCalledWith(expect.stringMatching(/assignable-teachers$/));
  });

  it("reads in Bangla", async () => {
    serve();
    renderApp(<ClassSetupPage />, { locale: "bn" });
    await screen.findByRole("table");
    expect(screen.getByRole("heading", { name: "ক্লাস সেটআপ" })).toBeTruthy();
    expect(within(rowFor("Class 6 A")).getByText("শনি, সোম")).toBeTruthy();
    expect(within(rowFor("Class 6 A")).getByText("১৬:০০–১৭:৩০")).toBeTruthy();
    expect(within(rowFor("Class 6 B")).getByText("এখনো সময়সূচি নেই")).toBeTruthy();
  });
});

describe("menu", () => {
  it("shows class setup to every staff role of an organisation and to solo teachers, with the attendance feature", () => {
    const items = sidebarList.filter((item) => item.route === "/attendance-setup");
    expect(items).toHaveLength(2);
    expect(items.every((item) => item.feature === "attendance")).toBe(true);
    expect(items.find((item) => item.category === "Organization")?.memberRoles).toEqual(["OWNER", "ADMIN", "ASSISTANT", "TEACHER"]);
    expect(items.find((item) => item.category === "Platform")?.personalWorkspaceOnly).toBe(true);
  });
});
