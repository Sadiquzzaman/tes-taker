import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/i18n/test-utils";
import OrganizationAssignments from "./OrganizationAssignments";

const get = vi.fn();
const post = vi.fn();
const put = vi.fn();
const del = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/organization/assignments" }));
vi.mock("@/lib/axios", () => ({
  default: {
    get: (...args: unknown[]) => get(...args),
    post: (...args: unknown[]) => post(...args),
    patch: vi.fn(),
    put: (...args: unknown[]) => put(...args),
    delete: (...args: unknown[]) => del(...args),
  },
}));
vi.mock("@/hooks/organization/useWorkspace", () => ({
  default: () => ({
    loading: false,
    sessionMode: "organization",
    organizationId: "org-1",
    activeOrganization: { id: "org-1", name: "Green School", status: "approved", role: "ADMIN" },
  }),
}));

const rina = { id: "t1", full_name: "Rina Akter" };
const karim = { id: "t2", full_name: "Karim Uddin" };
const session: AcademicSession = { id: "s1", name: "2026", start_date: "2026-01-01", end_date: "2026-12-31", status: "ACTIVE", is_default: true };
const section = (id: string, name: string): ClassSection => ({
  id,
  class_id: "c6",
  session_id: "s1",
  name,
  shift: null,
  room: null,
  class_teacher: null,
  student_count: 0,
});
const math = (id: string, sectionId: string, teachers: AcademicPerson[]): SubjectClass => ({
  id,
  section_id: sectionId,
  session_id: "s1",
  term_id: null,
  subject: { id: "sub-math", name: "Math", code: "MTH" },
  enrolment_mode: "WHOLE_SECTION",
  is_optional: false,
  teachers,
});

const data: Record<string, unknown> = {
  "/classes": [{ id: "c6", class_name: "Class 6", classSubjects: [{ id: "cs1", class_id: "c6", subject_id: "sub-math", subject: { id: "sub-math", name: "Math", code: "MTH" } }] }],
  "/organizations/org-1/subjects": [{ id: "sub-math", name: "Math", code: "MTH" }],
  "/organizations/org-1/assignable-teachers": [
    { id: "m1", role: "TEACHER", user: { ...rina, phone: null, email: null } },
    { id: "m2", role: "TEACHER", user: { ...karim, phone: null, email: null } },
  ],
  "/sessions": [session],
  "/sections": [section("sec-a", "A"), section("sec-b", "B")],
  "/offerings": [math("o-a", "sec-a", [rina]), math("o-b", "sec-b", [])],
};

beforeEach(() => {
  vi.clearAllMocks();
  get.mockImplementation((url: string) => {
    const path = url.replace(/^undefined/, "").split("?")[0];
    return path in data ? Promise.resolve({ data: { payload: data[path] } }) : Promise.reject(new Error(`unexpected GET ${path}`));
  });
  put.mockResolvedValue({ data: { payload: {} } });
});
afterEach(() => cleanup());

/** Types the option's text into a combobox and picks the first match with the keyboard. */
const pick = async (combobox: HTMLElement, option: string) => {
  fireEvent.change(combobox, { target: { value: option } });
  await screen.findByRole("option", { name: new RegExp(option) });
  fireEvent.keyDown(combobox, { key: "ArrowDown" });
  fireEvent.keyDown(combobox, { key: "Enter" });
  await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
};

describe("assignments by section (P2-03 part 3b)", () => {
  it("lists who teaches each subject in each section of the default session", async () => {
    renderApp(<OrganizationAssignments />);
    const table = await screen.findByRole("table", { name: "3. Current assignments" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows.map((row) => within(row).getAllByRole("cell").slice(0, 4).map((cell) => cell.textContent))).toEqual(
      expect.arrayContaining([
        ["Class 6", "A", "Math — MTH", "Rina Akter"],
        ["Class 6", "B", "Math — MTH", "No teacher yet"],
      ]),
    );
    expect(get).toHaveBeenCalledWith(expect.stringMatching(/\/offerings\?session_id=s1$/));
  });

  it("assigns a teacher to a subject in every section of the class at once", async () => {
    renderApp(<OrganizationAssignments />);
    await screen.findByRole("table", { name: "3. Current assignments" });
    const [, classInStep2] = screen.getAllByRole("combobox", { name: "Class" });
    await pick(classInStep2, "Class 6");
    await pick(screen.getByRole("combobox", { name: "Section" }), "All sections of the class");
    await pick(screen.getAllByRole("combobox", { name: "Subject" })[1], "Math");
    await pick(screen.getByRole("combobox", { name: "Teacher" }), "Karim Uddin");
    fireEvent.click(screen.getByRole("button", { name: "Assign teacher" }));

    // Each subject class keeps its teachers and gains Karim; nothing goes to the old class-level endpoints.
    await waitFor(() => expect(put).toHaveBeenCalledTimes(2));
    expect(put).toHaveBeenCalledWith(expect.stringMatching(/\/offerings\/o-a\/teachers$/), { teacher_ids: ["t1", "t2"] });
    expect(put).toHaveBeenCalledWith(expect.stringMatching(/\/offerings\/o-b\/teachers$/), { teacher_ids: ["t2"] });
    expect(post).not.toHaveBeenCalled();
  });

  it("asks before removing a teacher from one section's subject", async () => {
    renderApp(<OrganizationAssignments />);
    const table = await screen.findByRole("table", { name: "3. Current assignments" });
    fireEvent.click(within(table).getByRole("button", { name: "Remove" }));
    const dialog = await screen.findByRole("dialog", { name: "Remove Rina Akter from Math — MTH?" });
    expect(within(dialog).getByText("They will no longer teach this subject in Class 6 · A.")).toBeTruthy();
    expect(put).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(put).toHaveBeenCalledWith(expect.stringMatching(/\/offerings\/o-a\/teachers$/), { teacher_ids: [] }));
    expect(del).not.toHaveBeenCalled();
  });

  it("shows the sections in Bangla", async () => {
    renderApp(<OrganizationAssignments />, { locale: "bn" });
    const table = await screen.findByRole("table");
    expect(within(table).getByRole("columnheader", { name: /সেকশন/ })).toBeTruthy();
  });
});
