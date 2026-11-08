import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/i18n/test-utils";
import sidebarList from "@/utils/sidebarList";
import ClassSetupPage from "./ClassSetupPage";
import ScheduleImportDrawer from "./ScheduleImportDrawer";

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

  it("keeps the table's choices wide enough to read their value (found on beta at laptop width)", async () => {
    serve({ ...SETUP, sections: [S6A, { ...S6B, branch_id: "b-fg" }, S7A] }, [MAIN, FARMGATE]);
    renderApp(<ClassSetupPage />);
    await screen.findByRole("table");

    for (const label of ["Class type of Class 6 B", "Attendance mode of Class 6 B", "Late after, Class 6 B", "Branch of Class 6 B"]) {
      expect(table().getByLabelText(label).className).toMatch(/\bmin-w-(32|36)\b/);
    }
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

  it("shows each section's timetable read-only, with its subjects, and sends changes to the Routine", async () => {
    serve({ ...SETUP, sections: [{ ...S6A, slots: S6A.slots.map((x) => ({ ...x, subject: { id: "math", name: "Mathematics" } })) }, S6B, S7A] });
    renderApp(<ClassSetupPage />);
    await screen.findByRole("table");
    const sixA = within(rowFor("Class 6 A"));
    expect(sixA.getByText("16:00–17:30 · Mathematics")).toBeTruthy();
    expect(sixA.getByText("18:00–19:00 · Mathematics · Rina Akter")).toBeTruthy();
    expect(sixA.getByRole("link", { name: "Edit the routine of Class 6 A" }).getAttribute("href")).toBe("/routine?section=s6a");
    expect(within(rowFor("Class 6 B")).getByRole("link", { name: "Add periods in the Routine" }).getAttribute("href")).toBe("/routine?section=s6b");
    // The timetable is no longer edited or imported here.
    expect(table().queryByRole("button", { name: /Edit the schedule/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Import CSV" })).toBeNull();
    expect(get).not.toHaveBeenCalledWith(expect.stringMatching(/assignable-teachers$/));
  });

  it("applies a section's settings to the rest of its class or shift after a preview, never its periods", async () => {
    serve();
    post.mockImplementation((_url: string, body: { dry_run: boolean; shift?: string }) =>
      ok({
        dry_run: body.dry_run,
        sections: body.shift
          ? [{ id: "s7a", name: "A", class_name: "Class 7", slots_before: 0, teachers_dropped: 0 }]
          : [{ id: "s6b", name: "B", class_name: "Class 6", slots_before: 0, teachers_dropped: 0 }],
      }),
    );
    renderApp(<ClassSetupPage />);
    await screen.findByRole("table");

    fireEvent.click(table().getByRole("button", { name: "Apply the settings of Class 6 A to other sections" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Apply these settings to other sections" }));
    expect(await dialog.findByText("This section gets the settings:")).toBeTruthy();
    expect(dialog.getByText("Class 6 B")).toBeTruthy();
    expect(post).toHaveBeenCalledWith(expect.stringMatching(/\/attendance\/setup\/apply$/), {
      from_section_id: "s6a",
      class_id: "c-Class 6",
      include_schedule: false,
      include_settings: true,
      dry_run: true,
    });

    fireEvent.click(dialog.getByRole("radio", { name: "Every other section of the Morning shift" }));
    expect(await dialog.findByText("Class 7 A")).toBeTruthy();
    fireEvent.click(dialog.getByRole("button", { name: "Apply to 1 section" }));
    await waitFor(() =>
      expect(post).toHaveBeenLastCalledWith(expect.stringMatching(/\/apply$/), {
        from_section_id: "s6a",
        shift: "MORNING",
        include_schedule: false,
        include_settings: true,
        dry_run: false,
      }),
    );
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
    expect(table().queryByRole("button", { name: /^Apply the settings/ })).toBeNull();
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

const chooseFile = (drawer: HTMLElement, text: string) => {
  const input = drawer.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File([text], "schedule.csv", { type: "text/csv" });
  Object.defineProperty(file, "text", { value: () => Promise.resolve(text) });
  fireEvent.change(input, { target: { files: [file] } });
};

const CSV = "class,section,days,start,end\nClass 6,A,Sat;Mon,16:00,17:30\nClass 6,B,Sun,9:00 AM,10:00 AM\n";

describe("schedule CSV import (ATT-16)", () => {
  // The import opens from the Routine page; the drawer is tested on its own here.
  const onImported = vi.fn();
  const openImport = async (locale: "en" | "bn" = "en") => {
    renderApp(<ScheduleImportDrawer open sessionId="ses-1" onClose={vi.fn()} onImported={onImported} />, { locale });
    return await screen.findByRole("dialog", { name: locale === "en" ? "Import schedules from CSV" : "CSV থেকে সময়সূচি আনুন" });
  };

  it("checks the file, shows what each section gets, then imports and reloads", async () => {
    serve();
    const plan: ScheduleImportPreview = {
      session: { id: "ses-1", name: "2026" },
      valid: true,
      rows: [
        { row: 2, class: "Class 6", section: "A", days: [6, 1], start: "16:00", end: "17:30", errors: [] },
        { row: 3, class: "Class 6", section: "B", days: [7], start: "09:00", end: "10:00", errors: [] },
      ],
      sections: [
        { id: "s6a", name: "A", class_name: "Class 6", slots_before: 3, slots_after: 2, settings_changed: false },
        { id: "s6b", name: "B", class_name: "Class 6", slots_before: 0, slots_after: 1, settings_changed: true },
      ],
    };
    post.mockReturnValue(ok(plan));
    const drawer = await openImport();
    chooseFile(drawer, CSV);

    expect(await within(drawer).findByText("Every row is right. 2 sections in 2026 will get the times below.")).toBeTruthy();
    expect(post).toHaveBeenCalledWith(expect.stringMatching(/\/attendance\/setup\/import\/preview$/), {
      session_id: "ses-1",
      rows: [
        { class: "Class 6", section: "A", days: "Sat;Mon", start: "16:00", end: "17:30" },
        { class: "Class 6", section: "B", days: "Sun", start: "9:00 AM", end: "10:00 AM" },
      ],
    });
    expect(within(drawer).getByText("3 → 2 times")).toBeTruthy();
    expect(within(drawer).getByText("0 → 1 times · settings change")).toBeTruthy();

    fireEvent.click(within(drawer).getByRole("button", { name: "Import 2 sections" }));
    await waitFor(() => expect(post).toHaveBeenLastCalledWith(expect.stringMatching(/\/attendance\/setup\/import$/), expect.objectContaining({ session_id: "ses-1" })));
    await waitFor(() => expect(onImported).toHaveBeenCalledWith(2));
  });

  it("shows each row's problems and does not offer to import", async () => {
    serve();
    post.mockReturnValue(
      ok({
        session: { id: "ses-1", name: "2026" },
        valid: false,
        rows: [
          { row: 2, class: "Class 6", section: "A", days: [6, 1], start: "16:00", end: "17:30", errors: [] },
          { row: 3, class: "Class 9", section: "B", days: [], start: null, end: "10:00", errors: ["CLASS_NOT_FOUND", "DAYS_INVALID", "START_INVALID"] },
        ],
        sections: [{ id: "s6a", name: "A", class_name: "Class 6", slots_before: 0, slots_after: 2, settings_changed: false }],
      }),
    );
    const drawer = await openImport();
    chooseFile(drawer, CSV);

    expect(await within(drawer).findByText(/1 row has a problem/)).toBeTruthy();
    const table = within(within(drawer).getByRole("table"));
    expect(table.getByText("No class with this name in the session.")).toBeTruthy();
    expect(table.getByText("Days not understood. Write them like Sat;Mon.")).toBeTruthy();
    // The button says what to do instead of offering to import "1 section" (found on beta).
    expect(within(drawer).getByRole("button", { name: "Fix the file to import" })).toHaveProperty("disabled", true);
  });

  it("refuses a file without the needed columns before asking the API", async () => {
    serve();
    const drawer = await openImport();
    // The file box names the type and the size limit once (FileDrop adds the size).
    expect(within(drawer).getByText("CSV files up to 2 MB")).toBeTruthy();
    chooseFile(drawer, "class,section,days\nClass 6,A,Sat\n");
    expect(await within(drawer).findByText("The file needs these columns: start, end.")).toBeTruthy();
    expect(post).not.toHaveBeenCalled();
  });

  it("reads in Bangla", async () => {
    serve();
    expect(await openImport("bn")).toBeTruthy();
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
