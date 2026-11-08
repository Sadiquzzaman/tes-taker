import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/i18n/test-utils";
import sidebarList from "@/utils/sidebarList";
import RoutinePage from "./RoutinePage";

const get = vi.fn();
const post = vi.fn();
const patch = vi.fn();
const del = vi.fn();
let memberRole: string | undefined = "OWNER";
let searchSection: string | null = null;
let attendanceOn = true;
vi.mock("@/lib/authSession", () => ({ getStoredUser: () => ({ id: "me", role: memberRole === "STUDENT" ? "STUDENT" : "TEACHER", access_token: "token" }), clearAuthSession: vi.fn() }));
vi.mock("@/hooks/organization/useWorkspace", () => ({ default: () => ({ memberRole, isIndividual: false, organizationId: "org1" }) }));
vi.mock("@/hooks/api/subscription/useEntitlements", () => ({ default: () => ({ entitlements: { features: { calendar: true, attendance: attendanceOn } }, loading: false }) }));
vi.mock("@/lib/axios", () => ({
  default: {
    get: (...args: unknown[]) => get(...args),
    post: (...args: unknown[]) => post(...args),
    patch: (...args: unknown[]) => patch(...args),
    delete: (...args: unknown[]) => del(...args),
  },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/routine",
  useSearchParams: () => ({ get: (key: string) => (key === "section" ? searchSection : null) }),
}));

const ok = <T,>(payload: T) => Promise.resolve({ data: { payload } });

const sectionA = { id: "sa", name: "A", class_name: "Class 6" };
const sectionB = { id: "sb", name: "B", class_name: "Class 6" };
const slot = (extra: Partial<RoutineSlot> = {}): RoutineSlot => ({
  id: "r1",
  session_id: "s1",
  section: sectionA,
  subject: { offering_id: "o-a-math", id: "math", name: "Math" },
  teacher: { id: "t1", full_name: "Rina" },
  room: "Room 201",
  day_of_week: 6,
  start_time: "10:00",
  end_time: "10:45",
  clashes: [],
  ...extra,
});
const routine = (extra: Partial<RoutineView> = {}): RoutineView => ({
  session: { id: "s1", name: "2026", status: "ACTIVE" },
  can_manage: true,
  editable_section_ids: ["sa", "sb"],
  sections: [sectionA, sectionB],
  subject_classes: [
    { offering_id: "o-a-math", section_id: "sa", subject: { id: "math", name: "Math" }, teacher_ids: ["t1"] },
    { offering_id: "o-b-math", section_id: "sb", subject: { id: "math", name: "Math" }, teacher_ids: [] },
  ],
  rooms: ["Room 201"],
  slots: [slot()],
  ...extra,
});

const serve = (view: RoutineView = routine()) =>
  get.mockImplementation((url: string) => {
    if (url.endsWith("/routine")) return ok(view);
    if (url.endsWith("/sessions")) return ok([{ id: "s1", name: "2026" }]);
    if (url.endsWith("/assignable-teachers"))
      return ok([
        { id: "m1", role: "TEACHER", user: { id: "t1", full_name: "Rina", email: null, phone: null } },
        { id: "m2", role: "TEACHER", user: { id: "t2", full_name: "Karim", email: null, phone: null } },
      ]);
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });

beforeEach(() => {
  memberRole = "OWNER";
  searchSection = null;
  attendanceOn = true;
  for (const mock of [get, post, patch, del]) mock.mockReset();
});
afterEach(() => cleanup());

describe("routine (CAL-01, CAL-02)", () => {
  it("shows a section's week, Saturday first, and switches to a teacher's or a room's week", async () => {
    serve(routine({ slots: [slot(), slot({ id: "r2", section: sectionB, subject: null, teacher: null, day_of_week: 1, start_time: "09:00", end_time: "09:45", room: null })] }));
    renderApp(<RoutinePage />);
    const saturday = within(await screen.findByRole("region", { name: "Saturday" }));
    expect(saturday.getByText("10:00–10:45")).toBeTruthy();
    expect(saturday.getByText("Math")).toBeTruthy();
    expect(saturday.getByText("Rina")).toBeTruthy();
    expect(saturday.getByText("Room 201")).toBeTruthy();
    const days = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(days.slice(0, 3)).toEqual(["Saturday", "Sunday", "Monday"]);
    // Section B's class is not in section A's week.
    expect(within(screen.getByRole("region", { name: "Monday" })).getByText("No classes")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Show by"), { target: { value: "teacher" } });
    expect(await within(screen.getByRole("region", { name: "Saturday" })).findByText("Class 6 A")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Show by"), { target: { value: "room" } });
    expect((screen.getByLabelText("Room") as HTMLSelectElement).value).toBe("Room 201");
  });

  it("opens on the section the link names (from Class setup)", async () => {
    searchSection = "sb";
    serve(routine({ slots: [slot(), slot({ id: "r2", section: sectionB, day_of_week: 1 })] }));
    renderApp(<RoutinePage />);
    expect(((await screen.findByLabelText("Section")) as HTMLSelectElement).value).toBe("sb");
    expect(within(screen.getByRole("region", { name: "Monday" })).getByText("Math")).toBeTruthy();
  });

  it("adds a period on several days with the subject's teacher, and saves a clash only after Save anyway", async () => {
    serve();
    const clash = { kind: "TEACHER", slot_id: "r1", section: sectionA, day_of_week: 6, start_time: "10:00", end_time: "10:45" };
    post.mockRejectedValueOnce({ response: { status: 409, data: { code: "ROUTINE_CLASH", details: { clashes: [clash] } } } }).mockReturnValueOnce(ok([slot({ id: "r3" })]));
    renderApp(<RoutinePage />);
    fireEvent.click(await screen.findByRole("button", { name: "Add period" }));
    const drawer = within(await screen.findByRole("dialog", { name: "Add a period" }));
    expect((drawer.getByLabelText("Section") as HTMLSelectElement).value).toBe("sa");
    fireEvent.click(drawer.getByRole("button", { name: "Save" }));
    expect(await drawer.findByText("Choose at least one day.")).toBeTruthy();
    fireEvent.click(drawer.getByLabelText("Saturday"));
    fireEvent.click(drawer.getByLabelText("Monday"));
    fireEvent.click(drawer.getByRole("button", { name: "Save" }));
    expect(await drawer.findByText("Choose a start and an end time.")).toBeTruthy();
    fireEvent.change(drawer.getByLabelText("Start"), { target: { value: "10:15" } });
    fireEvent.change(drawer.getByLabelText("End"), { target: { value: "11:00" } });
    fireEvent.change(drawer.getByLabelText("Subject"), { target: { value: "o-a-math" } });
    const teacher = drawer.getByLabelText("Teacher") as HTMLSelectElement;
    expect(teacher.value).toBe("t1");
    // The subject's own teacher comes first and says so.
    expect([...teacher.options].map((o) => o.text)).toEqual(["No teacher", "Rina (teaches this subject)", "Karim"]);
    fireEvent.change(drawer.getByLabelText("Room"), { target: { value: " Lab " } });
    fireEvent.click(drawer.getByRole("button", { name: "Save" }));

    expect(await drawer.findByText("Same teacher: Class 6 A, Saturday 10:00–10:45")).toBeTruthy();
    expect(post.mock.calls[0][0]).toMatch(/\/routine\/slots\/many$/);
    expect(post.mock.calls[0][1]).toEqual({ section_id: "sa", days: [6, 1], start_time: "10:15", end_time: "11:00", offering_id: "o-a-math", teacher_id: "t1", room: "Lab" });
    fireEvent.click(drawer.getByRole("button", { name: "Save anyway" }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect(post.mock.calls[1][1]).toMatchObject({ confirm_clashes: true, days: [6, 1] });
    expect(await screen.findByText("Routine saved")).toBeTruthy();
  });

  it("marks clashes, changes a period and removes one after a confirmation", async () => {
    const clashing = slot({ clashes: [{ kind: "ROOM", slot_id: "r9", section: sectionB, day_of_week: 6, start_time: "10:00", end_time: "10:45" }] });
    serve(routine({ slots: [clashing] }));
    patch.mockReturnValue(ok(slot()));
    del.mockReturnValue(ok(null));
    renderApp(<RoutinePage />);
    expect(await screen.findByText(/1 class clashes with another class/)).toBeTruthy();
    expect(screen.getByText("Room booked twice")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /10:00–10:45/ }));
    let drawer = within(await screen.findByRole("dialog", { name: "Change this period" }));
    expect((drawer.getByLabelText("Section") as HTMLSelectElement).disabled).toBe(true);
    fireEvent.change(drawer.getByLabelText("Teacher"), { target: { value: "t2" } });
    fireEvent.click(drawer.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(patch).toHaveBeenCalledWith(expect.stringMatching(/\/routine\/slots\/r1$/), expect.objectContaining({ teacher_id: "t2", room: "Room 201", day_of_week: 6 })));

    fireEvent.click(await screen.findByRole("button", { name: /10:00–10:45/ }));
    drawer = within(await screen.findByRole("dialog", { name: "Change this period" }));
    fireEvent.click(drawer.getByRole("button", { name: "Remove" }));
    const confirm = within(await screen.findByRole("dialog", { name: "Remove this period from the routine?" }));
    fireEvent.click(confirm.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(del).toHaveBeenCalledWith(expect.stringMatching(/\/routine\/slots\/r1$/)));
  });

  it("copies another section's week after a confirmation, and imports a CSV with attendance on", async () => {
    serve(routine({ slots: [slot({ section: sectionB })] }));
    post.mockReturnValue(ok({ slots: 4, without_teacher: 1 }));
    renderApp(<RoutinePage />);
    expect(await screen.findByRole("button", { name: "Import CSV" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Copy from another section" }));
    const modal = within(await screen.findByRole("dialog", { name: "Copy a week into Class 6 A" }));
    const from = modal.getByLabelText("Copy from") as HTMLSelectElement;
    expect([...from.options].map((o) => o.text)).toEqual(["Choose a section", "Class 6 B"]);
    fireEvent.change(from, { target: { value: "sb" } });
    fireEvent.click(modal.getByRole("button", { name: "Copy week" }));
    const confirm = within(await screen.findByRole("dialog", { name: "Replace this section's week?" }));
    expect(confirm.getByText(/The section has no periods yet/)).toBeTruthy();
    fireEvent.click(confirm.getByRole("button", { name: "Copy week" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith(expect.stringMatching(/\/routine\/sections\/sa\/copy$/), { from_section_id: "sb" }));
    expect(await screen.findByText("4 periods copied")).toBeTruthy();
    expect(screen.getByText("1 period has no teacher yet.")).toBeTruthy();

    // Without attendance (calendar only) the CSV import is not offered.
    cleanup();
    attendanceOn = false;
    renderApp(<RoutinePage />);
    await screen.findByRole("button", { name: "Add period" });
    expect(screen.queryByRole("button", { name: "Import CSV" })).toBeNull();
  });

  it("lets a teacher change only the sections they teach, in Bangla too", async () => {
    memberRole = "TEACHER";
    serve(routine({ editable_section_ids: ["sa"], slots: [slot(), slot({ id: "r2", section: sectionB, day_of_week: 1 })] }));
    renderApp(<RoutinePage />);
    expect(await screen.findByRole("button", { name: "Add period" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /10:00–10:45/ })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Section"), { target: { value: "sb" } });
    // Section B is not theirs: no editing there.
    expect(screen.queryByRole("button", { name: "Add period" })).toBeNull();
    expect(screen.queryByRole("button", { name: /10:00–10:45/ })).toBeNull();
    expect(within(screen.getByRole("region", { name: "Monday" })).getByText("Math")).toBeTruthy();
    cleanup();
    renderApp(<RoutinePage />, { locale: "bn" });
    expect(await screen.findByRole("button", { name: "পিরিয়ড যোগ করুন" })).toBeTruthy();
  });
});

describe("routine for students", () => {
  it("shows their own section read-only, or says they are in none", async () => {
    memberRole = "STUDENT";
    serve(routine({ can_manage: false, editable_section_ids: [], sections: [sectionA], rooms: [] }));
    renderApp(<RoutinePage />);
    const saturday = within(await screen.findByRole("region", { name: "Saturday" }));
    expect(saturday.getByText("Math")).toBeTruthy();
    expect(screen.queryByLabelText("Show by")).toBeNull();
    expect(screen.queryByRole("button", { name: "Add period" })).toBeNull();
    expect(screen.queryByRole("button", { name: /10:00–10:45/ })).toBeNull();
    expect(get).not.toHaveBeenCalledWith(expect.stringMatching(/assignable-teachers$/));
    cleanup();
    serve(routine({ can_manage: false, editable_section_ids: [], sections: [], slots: [] }));
    renderApp(<RoutinePage />);
    expect(await screen.findByText("You are not in a section yet")).toBeTruthy();
  });
});

describe("menu", () => {
  it("puts Routine under Academics for staff, solo teachers and students, with the calendar or attendance feature", () => {
    const items = sidebarList.filter((entry) => entry.route === "/routine");
    expect(items).toHaveLength(3);
    expect(items.every((entry) => JSON.stringify(entry.feature) === JSON.stringify(["calendar", "attendance"]) && entry.group === "academics")).toBe(true);
    expect(items.find((entry) => entry.category === "Organization")?.memberRoles).toEqual(["OWNER", "ADMIN", "ASSISTANT", "TEACHER"]);
  });
});
