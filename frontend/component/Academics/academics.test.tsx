import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/i18n/test-utils";
import OrganizationSettingsCard from "../Organization/OrganizationSettingsCard";
import ClassSections from "./ClassSections";
import SessionsPage from "./SessionsPage";

const get = vi.fn();
const post = vi.fn();
const patch = vi.fn();
const put = vi.fn();
const del = vi.fn();
const workspace = vi.fn();
const storedUser = vi.fn();
vi.mock("@/lib/authSession", () => ({ getStoredUser: () => storedUser() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/sessions" }));
vi.mock("@/lib/axios", () => ({
  default: {
    get: (...args: unknown[]) => get(...args),
    post: (...args: unknown[]) => post(...args),
    patch: (...args: unknown[]) => patch(...args),
    put: (...args: unknown[]) => put(...args),
    delete: (...args: unknown[]) => del(...args),
  },
}));
vi.mock("@/hooks/organization/useWorkspace", () => ({ default: () => workspace() }));

const school = (role: OrganizationMemberRole) => ({
  isIndividual: false,
  organizationId: "org-1",
  activeOrganization: { id: "org-1", name: "Green School", status: "approved", role },
});
const solo = { isIndividual: true, organizationId: null, activeOrganization: null };
/** The signed-in session: a school session, or a personal one with personal teaching on or off. */
const SCHOOL_USER = { session_mode: "organization" };
const SOLO_USER = { session_mode: "individual", personal_teacher_enabled: true };
const NO_PERSONAL_USER = { session_mode: "individual", personal_teacher_enabled: false };

const ok = <T,>(payload: T) => Promise.resolve({ data: { payload } });

/** Answers GET requests by the end of their URL. */
const routes = (table: Record<string, unknown>) => {
  get.mockImplementation((url: string) => {
    const path = url.replace(/^undefined/, "");
    const match = Object.keys(table).find((key) => path.endsWith(key) || path.includes(`${key}?`));
    return match ? ok(table[match]) : Promise.reject(new Error(`unexpected GET ${path}`));
  });
};

const thisYear: AcademicSession = { id: "s1", name: "2026", start_date: "2026-01-01", end_date: "2026-12-31", status: "ACTIVE", is_default: true };
const lastYear: AcademicSession = { id: "s0", name: "2025", start_date: "2025-01-01", end_date: "2025-12-31", status: "CLOSED", is_default: false };
const batch: AcademicSession = { id: "s2", name: "Batch 2", start_date: "2027-01-01", end_date: "2027-06-30", status: "ACTIVE", is_default: false };

beforeEach(() => {
  vi.clearAllMocks();
  storedUser.mockReturnValue(SCHOOL_USER);
  post.mockResolvedValue({ data: { payload: {} } });
  patch.mockResolvedValue({ data: { payload: {} } });
  put.mockResolvedValue({ data: { payload: {} } });
  del.mockResolvedValue({});
});
afterEach(() => cleanup());

describe("sessions page (FND-01)", () => {
  beforeEach(() => {
    routes({ "/sessions": [thisYear, batch, lastYear], "/terms": [] });
  });

  it("lists sessions with the default marked; the default cannot be closed", async () => {
    workspace.mockReturnValue(school("ADMIN"));
    renderApp(<SessionsPage />);
    const table = await screen.findByRole("table");
    const rows = within(table).getAllByRole("row");
    const row2026 = rows.find((row) => within(row).queryByText("2026")) as HTMLElement;
    expect(within(row2026).getByText("Default")).toBeTruthy();
    expect(within(row2026).queryByRole("button", { name: "Close 2026" })).toBeNull();
    expect(within(table).getByRole("button", { name: "Close Batch 2" })).toBeTruthy();
    // Only the owner reopens a closed session.
    expect(within(table).queryByRole("button", { name: "Reopen 2025" })).toBeNull();
  });

  it("asks before closing, then closes", async () => {
    workspace.mockReturnValue(school("OWNER"));
    renderApp(<SessionsPage />);
    fireEvent.click(within(await screen.findByRole("table")).getByRole("button", { name: "Close Batch 2" }));
    const dialog = await screen.findByRole("dialog", { name: "Close Batch 2?" });
    expect(post).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Close session" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith(expect.stringMatching(/\/sessions\/s2\/close$/)));
    expect(within(screen.getByRole("table")).getByRole("button", { name: "Reopen 2025" })).toBeTruthy();
  });

  it("adds a session, refusing an end date before the start", async () => {
    workspace.mockReturnValue(school("OWNER"));
    renderApp(<SessionsPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Add session" }));
    const drawer = await screen.findByRole("dialog", { name: "Add session" });
    fireEvent.change(within(drawer).getByLabelText(/Name/), { target: { value: "2027" } });
    fireEvent.change(within(drawer).getByLabelText(/Starts/), { target: { value: "2027-12-31" } });
    fireEvent.change(within(drawer).getByLabelText(/Ends/), { target: { value: "2027-01-01" } });
    expect(within(drawer).getByText("The end date must be on or after the start date.")).toBeTruthy();
    const save = within(drawer).getByRole("button", { name: "Save" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);

    fireEvent.change(within(drawer).getByLabelText(/Starts/), { target: { value: "2027-01-01" } });
    fireEvent.change(within(drawer).getByLabelText(/Ends/), { target: { value: "2027-12-31" } });
    fireEvent.click(within(drawer).getByRole("checkbox", { name: "Make it the default session" }));
    fireEvent.click(save);
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(expect.stringMatching(/\/sessions$/), {
        name: "2027",
        start_date: "2027-01-01",
        end_date: "2027-12-31",
        is_default: true,
      }),
    );
  });

  it("is for owners and admins only, and works in Bangla", async () => {
    workspace.mockReturnValue(school("TEACHER"));
    renderApp(<SessionsPage />);
    expect(screen.getByText("Only owners and admins can manage sessions.")).toBeTruthy();
    expect(get).not.toHaveBeenCalled();
    cleanup();

    workspace.mockReturnValue(solo);
    storedUser.mockReturnValue(SOLO_USER);
    renderApp(<SessionsPage />, { locale: "bn" });
    expect(await screen.findByRole("heading", { name: "সেশন" })).toBeTruthy();
    expect(within(await screen.findByRole("table")).getByText("ডিফল্ট")).toBeTruthy();
  });
});

describe("whose workspace it is (beta check after P2-03)", () => {
  it("gives a teacher with personal teaching off no sessions of their own, and asks the API nothing", async () => {
    workspace.mockReturnValue(solo);
    storedUser.mockReturnValue(NO_PERSONAL_USER);
    renderApp(<SessionsPage />);
    expect(screen.getByText("Only owners and admins can manage sessions.")).toBeTruthy();
    expect(get).not.toHaveBeenCalled();
  });

  it("waits for a school workspace to load instead of treating the session as personal", async () => {
    // Right after sign-in the workspace state still says "personal" while the session is a school's.
    workspace.mockReturnValue({ ...solo, isIndividual: true });
    storedUser.mockReturnValue({ ...SCHOOL_USER, personal_teacher_enabled: true });
    renderApp(<SessionsPage />);
    expect(get).not.toHaveBeenCalled();
    cleanup();

    routes({ "/sessions": [thisYear] });
    workspace.mockReturnValue(school("OWNER"));
    renderApp(<SessionsPage />);
    expect(await screen.findByRole("table")).toBeTruthy();
  });
});

describe("organisation settings", () => {
  it("switches class teachers off", async () => {
    workspace.mockReturnValue(school("OWNER"));
    routes({ "/organizations/org-1/settings": { organization_id: "org-1", class_teacher_enabled: true } });
    patch.mockResolvedValue({ data: { payload: { organization_id: "org-1", class_teacher_enabled: false } } });
    renderApp(<OrganizationSettingsCard organizationId="org-1" />);
    const toggle = await screen.findByRole("switch", { name: "Sections have a class teacher" });
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(toggle);
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith(expect.stringMatching(/\/organizations\/org-1\/settings$/), { class_teacher_enabled: false }),
    );
  });
});

describe("class sections (FND-02, FND-04, FND-19)", () => {
  const sectionA: ClassSection = {
    id: "sec-a",
    class_id: "c1",
    session_id: "s1",
    name: "A",
    shift: "MORNING",
    room: "204",
    class_teacher: { id: "t1", full_name: "Rina Akter" },
    student_count: 2,
  };
  const sectionB: ClassSection = { ...sectionA, id: "sec-b", name: "B", shift: null, room: null, class_teacher: null, student_count: 0 };
  const enrolments: SectionEnrolment[] = [
    { id: "e1", student: { id: "u1", full_name: "Nadia Rahman", email: null, phone: null }, roll_no: "1", status: "ACTIVE", invited_email: null, invited_phone: null, invited_name: null, joined_at: null },
    { id: "e2", student: { id: "u2", full_name: "Karim Uddin", email: null, phone: null }, roll_no: "2", status: "ACTIVE", invited_email: null, invited_phone: null, invited_name: null, joined_at: null },
  ];
  const religion: SubjectClass = {
    id: "o1",
    section_id: "sec-a",
    session_id: "s1",
    term_id: null,
    subject: { id: "sub-isl", name: "Islam Shikkha", code: null },
    enrolment_mode: "WHOLE_SECTION",
    is_optional: false,
    teachers: [],
  };

  const setup = (classTeacherEnabled: boolean) =>
    routes({
      "/sessions": [thisYear],
      "/organizations/org-1/settings": { organization_id: "org-1", class_teacher_enabled: classTeacherEnabled },
      "/organizations/org-1/assignable-teachers": [{ id: "m1", role: "TEACHER", user: { id: "t1", full_name: "Rina Akter", phone: null, email: null } }],
      "/classes/c1/sections": [sectionA, sectionB],
      "/sections/sec-a/enrolments": enrolments,
      "/sections/sec-a/offerings": [religion],
      "/classes/c1/subjects": [{ id: "cs1", class_id: "c1", subject_id: "sub-isl", subject: { id: "sub-isl", name: "Islam Shikkha" } }],
      "/offerings/o1/roster": [],
    });

  it("lists the sections of the default session with their class teacher", async () => {
    workspace.mockReturnValue(school("ADMIN"));
    setup(true);
    renderApp(<ClassSections classId="c1" />);
    const table = await screen.findByRole("table");
    expect(within(table).getByText("Rina Akter")).toBeTruthy();
    expect(within(table).getByText("2 students")).toBeTruthy();
    expect(get).toHaveBeenCalledWith(expect.stringMatching(/\/classes\/c1\/sections\?session_id=s1$/));
  });

  it("offers the class teacher field only while the organisation uses class teachers", async () => {
    workspace.mockReturnValue(school("ADMIN"));
    setup(false);
    renderApp(<ClassSections classId="c1" />);
    await screen.findByRole("table");
    expect(screen.queryByRole("columnheader", { name: /Class teacher/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Add section" }));
    const drawer = await screen.findByRole("dialog", { name: "Add section" });
    expect(within(drawer).queryByLabelText(/Class teacher/)).toBeNull();
    fireEvent.change(within(drawer).getByLabelText(/Section name/), { target: { value: "C" } });
    fireEvent.click(within(drawer).getByRole("button", { name: "Add section" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith(expect.stringMatching(/\/classes\/c1\/sections$/), expect.objectContaining({ name: "C", session_id: "s1" })));
  });

  it("lets other teachers look but not change", async () => {
    workspace.mockReturnValue(school("TEACHER"));
    setup(true);
    renderApp(<ClassSections classId="c1" />);
    await screen.findByRole("table");
    expect(screen.queryByRole("button", { name: "Add section" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete section A" })).toBeNull();
  });

  it("gives teachers the guardians of the section's students, without the student changes", async () => {
    workspace.mockReturnValue(school("TEACHER"));
    setup(true);
    renderApp(<ClassSections classId="c1" />);
    fireEvent.click(within(await screen.findByRole("table")).getByRole("button", { name: "Open section A" }));
    const drawer = await screen.findByRole("dialog", { name: "Section A" });
    const roster = await within(drawer).findByRole("table");
    expect(within(roster).getByRole("button", { name: "Guardians of Karim Uddin" })).toBeTruthy();
    expect(within(roster).queryByRole("button", { name: "Mark Karim Uddin as left" })).toBeNull();
  });

  it("marks a student as left after asking; nothing is deleted", async () => {
    workspace.mockReturnValue(school("ASSISTANT"));
    setup(true);
    renderApp(<ClassSections classId="c1" />);
    fireEvent.click(within(await screen.findByRole("table")).getByRole("button", { name: "Open section A" }));
    const drawer = await screen.findByRole("dialog", { name: "Section A" });
    const roster = await within(drawer).findByRole("table");
    // The student's name comes first (on phones it is each card's title), then the roll number.
    expect(within(roster).getAllByRole("columnheader").map((header) => header.textContent?.trim())).toEqual(
      expect.arrayContaining(["Student", "Roll"]),
    );
    expect(within(roster).getAllByRole("columnheader")[0].textContent).toMatch(/^Student/);
    fireEvent.click(within(roster).getByRole("button", { name: "Mark Karim Uddin as left" }));
    const confirm = await screen.findByRole("dialog", { name: "Mark Karim Uddin as left?" });
    expect(within(confirm).getByText("They leave this class. Their record is kept, and they can be added again.")).toBeTruthy();
    fireEvent.click(within(confirm).getByRole("button", { name: "Mark as left" }));
    await waitFor(() => expect(patch).toHaveBeenCalledWith(expect.stringMatching(/\/enrolments\/e2$/), { status: "LEFT" }));
    expect(del).not.toHaveBeenCalled();
  });

  it("adds a student to the section by phone or email", async () => {
    workspace.mockReturnValue(school("OWNER"));
    setup(true);
    post.mockResolvedValue({ data: { payload: { outcome: "INVITED" } } });
    renderApp(<ClassSections classId="c1" />);
    fireEvent.click(within(await screen.findByRole("table")).getByRole("button", { name: "Open section A" }));
    const drawer = await screen.findByRole("dialog", { name: "Section A" });
    fireEvent.change(within(drawer).getByLabelText(/Phone or email/), { target: { value: "new@school.test" } });
    fireEvent.change(within(drawer).getByLabelText(/Roll number/), { target: { value: "3" } });
    fireEvent.click(within(drawer).getByRole("button", { name: "Add student" }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(expect.stringMatching(/\/sections\/sec-a\/enrolments$/), { email: "new@school.test", roll_no: "3" }),
    );
    expect(await screen.findByText("Invitation saved. Share the class link so they can join.")).toBeTruthy();
  });

  it("makes religion an optional subject taken by the chosen students", async () => {
    workspace.mockReturnValue(school("OWNER"));
    setup(true);
    renderApp(<ClassSections classId="c1" />);
    fireEvent.click(within(await screen.findByRole("table")).getByRole("button", { name: "Open section A" }));
    const drawer = await screen.findByRole("dialog", { name: "Section A" });
    fireEvent.click(within(drawer).getByRole("tab", { name: "Subjects" }));
    fireEvent.click(within(await within(drawer).findByRole("table")).getByRole("button", { name: "Edit Islam Shikkha" }));
    const editor = await screen.findByRole("dialog", { name: "Islam Shikkha: teachers and students" });
    fireEvent.click(within(editor).getByRole("checkbox", { name: /Only selected students take it/ }));
    fireEvent.click(await within(editor).findByRole("checkbox", { name: "1 · Nadia Rahman" }));
    fireEvent.click(within(editor).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(put).toHaveBeenCalledWith(expect.stringMatching(/\/offerings\/o1\/students$/), { student_ids: ["u1"] }));
    expect(patch).toHaveBeenCalledWith(expect.stringMatching(/\/offerings\/o1$/), { enrolment_mode: "SELECTED", is_optional: true });
    expect(put).toHaveBeenCalledWith(expect.stringMatching(/\/offerings\/o1\/teachers$/), { teacher_ids: [] });
  });

  it("has no class teachers or teacher picker in a solo workspace", async () => {
    workspace.mockReturnValue(solo);
    storedUser.mockReturnValue(SOLO_USER);
    setup(true);
    renderApp(<ClassSections classId="c1" />, { locale: "bn" });
    await screen.findByRole("table");
    expect(get).not.toHaveBeenCalledWith(expect.stringContaining("/settings"));
    expect(screen.getByRole("button", { name: "সেকশন যোগ করুন" })).toBeTruthy();
  });
});
