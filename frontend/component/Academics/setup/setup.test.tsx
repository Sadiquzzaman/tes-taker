import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SetupBanner from "@/component/Organization/SetupBanner";
import { renderApp } from "@/i18n/test-utils";
import PromoteStudentsDrawer from "../PromoteStudentsDrawer";
import SectionStudents from "../SectionStudents";
import SetupWizard from "./SetupWizard";

const get = vi.fn();
const post = vi.fn();
const patch = vi.fn();
const push = vi.fn();
const workspace = vi.fn();
const storedUser = vi.fn();
vi.mock("@/lib/authSession", () => ({ getStoredUser: () => storedUser() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }), usePathname: () => "/organization/setup" }));
vi.mock("@/lib/axios", () => ({
  default: {
    get: (...args: unknown[]) => get(...args),
    post: (...args: unknown[]) => post(...args),
    patch: (...args: unknown[]) => patch(...args),
  },
}));
vi.mock("@/hooks/organization/useWorkspace", () => ({ default: () => workspace() }));

const school = (role: OrganizationMemberRole) => ({
  loading: false,
  sessionMode: "organization",
  isIndividual: false,
  organizationId: "org-1",
  workspace: { type: "organization", id: "org-1" },
  activeOrganization: { id: "org-1", name: "Green School", status: "approved", role },
});

const ok = <T,>(payload: T) => Promise.resolve({ data: { payload } });

/** Answers GET requests by the end of their URL (without the query). */
const routes = (table: Record<string, unknown>) => {
  get.mockImplementation((url: string) => {
    const path = url.replace(/^undefined/, "").split("?")[0];
    const match = Object.keys(table).find((key) => path.endsWith(key));
    return match ? ok(table[match]) : Promise.reject(new Error(`unexpected GET ${path}`));
  });
};

const thisYear: AcademicSession = { id: "s1", name: "2026", start_date: "2026-01-01", end_date: "2026-12-31", status: "ACTIVE", is_default: true };
const nextYear: AcademicSession = { id: "s2", name: "2027", start_date: "2027-01-01", end_date: "2027-12-31", status: "ACTIVE", is_default: false };
const summary = (classes: AcademicSetupSummary["classes"], done = false): AcademicSetupSummary => ({
  setup_completed_at: done ? "2026-10-30T10:00:00Z" : null,
  session: { id: "s1", name: "2026", start_date: "2026-01-01", end_date: "2026-12-31" },
  classes,
});
const class6 = { id: "c6", name: "Class 6", subject_count: 1, section_count: 1 };

beforeEach(() => {
  vi.clearAllMocks();
  workspace.mockReturnValue(school("OWNER"));
  storedUser.mockReturnValue({ session_mode: "organization" });
  post.mockResolvedValue({ data: { payload: {} } });
});
afterEach(() => cleanup());

const next = () => fireEvent.click(screen.getByRole("button", { name: "Next" }));

describe("academic setup wizard (FND-02)", () => {
  it("walks through five steps and finishes once every class has a section", async () => {
    routes({
      "/workspace/level-labels": { preset: "CLASS_SECTION", class: { en: { one: "Class", other: "Classes" }, bn: "ক্লাস" }, section: { en: { one: "Section", other: "Sections" }, bn: "সেকশন" } },
      "/organizations/org-1/settings": { organization_id: "org-1", class_teacher_enabled: true, default_locale: "bn", setup_completed_at: null },
      "/sessions": [thisYear],
      "/setup": summary([class6]),
      "/organizations/org-1/subjects": [{ id: "m", name: "Math", code: "MTH" }],
      "/classes/c6/subjects": [{ id: "cs1", class_id: "c6", subject_id: "m", subject: { id: "m", name: "Math" } }],
      "/classes/c6/sections": [{ id: "a", class_id: "c6", session_id: "s1", name: "A", shift: null, room: null, class_teacher: null, student_count: 0 }],
      "/organizations/org-1/assignable-teachers": [],
    });
    renderApp(<SetupWizard />);

    // 1. Names (the owner may rename) and language.
    expect(await screen.findByText("Names for classes and sections")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Back" }).hasAttribute("disabled")).toBe(true);
    next();
    // 2. The session.
    expect(await screen.findByText("2026")).toBeTruthy();
    next();
    // 3. Classes and subjects.
    expect(await screen.findByText("Class 6")).toBeTruthy();
    next();
    // 4. Sections, with the class screens' own card.
    expect(await screen.findByRole("heading", { name: "Class 6" })).toBeTruthy();
    next();
    // 5. Summary, then finish.
    expect((await screen.findAllByText("Ready")).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Finish setup" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith(expect.stringMatching(/\/setup\/complete$/)));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/organization"));
  });

  it("does not finish while a class has no section, and says which", async () => {
    routes({ "/setup": summary([{ ...class6, section_count: 0 }]) });
    renderApp(<SetupWizard />);
    // Straight to the summary: the steps save as they go, so any step can be skipped.
    for (let i = 0; i < 4; i += 1) next();
    expect(await screen.findByText("Add a section to: Class 6.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Finish setup" }).hasAttribute("disabled")).toBe(true);
  });

  it("shows admins the names without letting them change them", async () => {
    workspace.mockReturnValue(school("ADMIN"));
    routes({ "/organizations/org-1/settings": { organization_id: "org-1", class_teacher_enabled: true, default_locale: "bn", setup_completed_at: null } });
    renderApp(<SetupWizard />);
    expect(await screen.findByText(/Only the owner can rename classes and sections/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Save names" })).toBeNull();
  });

  it("adds a class and a subject to it", async () => {
    routes({
      "/setup": summary([{ ...class6, subject_count: 0 }]),
      "/organizations/org-1/subjects": [{ id: "m", name: "Math", code: "MTH" }],
      "/classes/c6/subjects": [],
    });
    renderApp(<SetupWizard />);
    next();
    next();
    fireEvent.change(await screen.findByLabelText("Class name"), { target: { value: "Class 7" } });
    fireEvent.click(screen.getByRole("button", { name: "Add class" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith(expect.stringMatching(/\/classes$/), { class_name: "Class 7" }));

    fireEvent.change(await screen.findByLabelText("Subject to add to Class 6"), { target: { value: "m" } });
    fireEvent.click(screen.getByRole("button", { name: "Add subject" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith(expect.stringMatching(/\/classes\/c6\/subjects$/), { subject_id: "m" }));
  });

  it("is only for owners and admins", async () => {
    workspace.mockReturnValue(school("TEACHER"));
    renderApp(<SetupWizard />);
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
  });
});

describe("setup banner", () => {
  it("leads to the wizard until the setup is finished", async () => {
    routes({ "/setup": summary([]) });
    renderApp(<SetupBanner />);
    expect((await screen.findByRole("link", { name: "Start setup" })).getAttribute("href")).toBe("/organization/setup");
  });

  it("then only offers to open it again", async () => {
    routes({ "/setup": summary([class6], true) });
    renderApp(<SetupBanner />);
    expect(await screen.findByRole("link", { name: "Open academic setup" })).toBeTruthy();
    expect(screen.queryByText("Finish setting up")).toBeNull();
  });
});

describe("promoting students (FND-05)", () => {
  const section: ClassSection = { id: "a", class_id: "c6", session_id: "s1", name: "A", shift: null, room: null, class_teacher: null, student_count: 2 };
  const student = (id: string, name: string, roll: string | null = null): SectionEnrolment => ({
    id,
    student: { id: `u-${id}`, full_name: name, email: null, phone: null },
    roll_no: roll,
    status: "ACTIVE",
    invited_email: null,
    invited_phone: null,
    joined_at: null,
  });
  const students = [student("e1", "Nadia Rahman", "1"), student("e2", "Karim Uddin", "2")];
  const nextSection: ClassSection = { ...section, id: "b", class_id: "c7", session_id: "s2", name: "A", student_count: 0 };

  const setup = () =>
    routes({
      "/sessions": [thisYear, nextYear],
      "/classes": [
        { id: "c6", class_name: "Class 6" },
        { id: "c7", class_name: "Class 7" },
      ],
      "/classes/c6/sections": [{ ...section, id: "a-next", session_id: "s2" }],
      "/classes/c7/sections": [nextSection],
    });

  it("moves the ticked students after showing where they go", async () => {
    setup();
    post.mockResolvedValue({ data: { payload: { promoted: [{ student_id: "u-e1", full_name: "Nadia Rahman" }], skipped: [] } } });
    const onPromoted = vi.fn();
    renderApp(<PromoteStudentsDrawer section={section} students={students} onClose={vi.fn()} onPromoted={onPromoted} />);

    fireEvent.change(await screen.findByLabelText("Class"), { target: { value: "c7" } });
    // Karim is held back.
    fireEvent.click(await screen.findByLabelText("Karim Uddin (roll 2)"));
    expect(await screen.findByText("1 student moves to Class 7 · A (2027). 1 student stays here.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Promote 1 student" }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(expect.stringMatching(/\/sections\/a\/promotions$/), { target_section_id: "b", enrolment_ids: ["e1"] }),
    );
    expect(await screen.findByText("1 student was promoted.")).toBeTruthy();
    expect(onPromoted).toHaveBeenCalled();
  });

  it("lists students who were already in that class", async () => {
    setup();
    post.mockResolvedValue({
      data: { payload: { promoted: [], skipped: [{ student_id: "u-e2", full_name: "Karim Uddin", reason: "ALREADY_ENROLLED" }] } },
    });
    renderApp(<PromoteStudentsDrawer section={section} students={[students[1]]} onClose={vi.fn()} onPromoted={vi.fn()} />);
    // Same class, next year's section A.
    expect(await screen.findByText("1 student moves to Class 6 · A (2027). Nobody stays behind.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Promote 1 student" }));
    const result = await screen.findByRole("status");
    expect(within(result).getByText("1 student was already in that class and was not moved:")).toBeTruthy();
    expect(within(result).getByText("Karim Uddin")).toBeTruthy();
  });

  it("asks for next year's session first when there is none", async () => {
    routes({ "/sessions": [thisYear], "/classes": [] });
    renderApp(<PromoteStudentsDrawer section={section} students={students} onClose={vi.fn()} onPromoted={vi.fn()} />);
    expect(await screen.findByText("No other open session")).toBeTruthy();
  });

  it("is offered to owners and admins, not assistants", async () => {
    routes({ "/sections/a/enrolments": students });
    renderApp(<SectionStudents section={section} sections={[section]} editable onChanged={vi.fn()} />);
    expect(await screen.findByRole("button", { name: "Promote students" })).toBeTruthy();
    cleanup();

    workspace.mockReturnValue(school("ASSISTANT"));
    renderApp(<SectionStudents section={section} sections={[section]} editable onChanged={vi.fn()} />);
    expect((await screen.findAllByText("Nadia Rahman")).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Promote students" })).toBeNull();
  });
});
