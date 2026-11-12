import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/i18n/test-utils";
import { OrganizationStudents, OrganizationTeachers, parsePhoneList } from "./OrganizationMembers";
import OrganizationOverview from "./OrganizationOverview";
import OrganizationSubjects from "./OrganizationSubjects";
import OrganizationWorkspaceGate from "./OrganizationWorkspaceGate";

const get = vi.fn();
const post = vi.fn();
const del = vi.fn();
const workspace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/organization" }));
vi.mock("@/lib/axios", () => ({
  default: {
    get: (...args: unknown[]) => get(...args),
    post: (...args: unknown[]) => post(...args),
    patch: vi.fn(),
    delete: (...args: unknown[]) => del(...args),
  },
}));
vi.mock("@/hooks/organization/useWorkspace", () => ({ default: () => workspace() }));

const org = (status: OrganizationStatus, role: OrganizationMemberRole) => ({
  loading: false,
  sessionMode: "organization",
  organizationId: "org-1",
  activeOrganization: { id: "org-1", name: "Green School", status, role },
});

beforeEach(() => {
  vi.clearAllMocks();
  workspace.mockReturnValue(org("approved", "OWNER"));
});
afterEach(() => cleanup());

describe("workspace gate", () => {
  it("asks for an organisation when none is open", () => {
    workspace.mockReturnValue({ loading: false, sessionMode: "personal", organizationId: null, activeOrganization: null });
    renderApp(<OrganizationWorkspaceGate>secret</OrganizationWorkspaceGate>);
    expect(screen.queryByText("secret")).toBeNull();
    expect(screen.getByRole("link", { name: "Choose workspace" }).getAttribute("href")).toBe("/dashboard");
  });

  it("locks a pending organisation, in Bangla too", () => {
    workspace.mockReturnValue(org("pending", "OWNER"));
    renderApp(<OrganizationWorkspaceGate>secret</OrganizationWorkspaceGate>, { locale: "bn" });
    expect(screen.getByText("আপনার প্রতিষ্ঠান অনুমোদনের অপেক্ষায়")).toBeTruthy();
  });

  it("blocks roles that are not allowed", () => {
    workspace.mockReturnValue(org("approved", "TEACHER"));
    renderApp(<OrganizationWorkspaceGate allowedRoles={["OWNER"]}>secret</OrganizationWorkspaceGate>);
    expect(screen.getByText("You don't have access")).toBeTruthy();
  });
});

describe("members", () => {
  const members = [
    { id: "m1", role: "OWNER", created_at: "2026-01-01T00:00:00.000Z", user: { id: "u1", full_name: "Owner One", phone: "01700000001", email: null } },
    { id: "m2", role: "TEACHER", created_at: "2026-02-01T00:00:00.000Z", user: { id: "u2", full_name: "Rina Akter", phone: "01700000002", email: null } },
    { id: "m3", role: "STUDENT", user: { id: "u3", full_name: "Student Three", phone: null, email: null } },
  ];

  it("splits a pasted phone list on new lines, commas and semicolons", () => {
    expect(parsePhoneList("017\n018, 019;\n\n")).toEqual(["017", "018", "019"]);
  });

  it("lists teachers only and asks before removing one", async () => {
    get.mockResolvedValue({ data: { payload: members } });
    del.mockResolvedValue({});
    renderApp(<OrganizationTeachers />);
    const table = await screen.findByRole("table");
    expect(within(table).getByText("Rina Akter")).toBeTruthy();
    expect(within(table).queryByText("Student Three")).toBeNull();
    // The owner cannot be removed.
    expect(within(table).getAllByRole("button", { name: "Remove" })).toHaveLength(1);
    fireEvent.click(within(table).getByRole("button", { name: "Remove" }));
    const dialog = await screen.findByRole("dialog", { name: "Remove Rina Akter from the organisation?" });
    expect(del).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(del).toHaveBeenCalledWith(expect.stringMatching(/\/organizations\/org-1\/members\/m2$/)));
  });

  it("puts a new student straight into the chosen section", async () => {
    get.mockImplementation((url: string) => {
      const path = url.split("?")[0];
      if (path.endsWith("/members")) return Promise.resolve({ data: { payload: members } });
      if (path.endsWith("/members/lookup"))
        return Promise.resolve({ data: { payload: { found: true, query: "01700000009", query_type: "phone", user: { id: "u9", full_name: "Mitu", email: null, phone: "01700000009", teacher_public_id: null, student_public_id: "S9", is_otp_verified: true }, membership: null } } });
      if (path.endsWith("/sections"))
        return Promise.resolve({ data: { payload: [{ id: "s10", class_id: "c10", name: "A" }, { id: "s6", class_id: "c6", name: "A" }] } });
      if (path.endsWith("/classes")) return Promise.resolve({ data: { payload: [{ id: "c6", class_name: "Class 6" }, { id: "c10", class_name: "Class 10" }] } });
      return Promise.reject(new Error(`unexpected GET ${path}`));
    });
    post.mockResolvedValue({ data: { payload: { outcome: "ENROLLED" } } });
    renderApp(<OrganizationStudents />);
    await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button", { name: "Add student" }));
    const drawer = within(await screen.findByRole("dialog", { name: "Add student" }));
    const section = drawer.getByLabelText("Section (optional)") as HTMLSelectElement;
    await waitFor(() => expect(section.options.length).toBe(3));
    expect([...section.options].map((option) => option.text)).toEqual(["Choose later", "Class 6 A", "Class 10 A"]);
    fireEvent.change(section, { target: { value: "s6" } });
    fireEvent.change(drawer.getByLabelText("Student ID, phone or email"), { target: { value: "01700000009" } });
    fireEvent.click(drawer.getByRole("button", { name: "Search" }));
    fireEvent.click(await drawer.findByRole("button", { name: "Add to Class 6 A" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith(expect.stringMatching(/\/sections\/s6\/enrolments$/), { student_id: "u9" }));
    expect(await screen.findByText("Added to Class 6 A")).toBeTruthy();
  });

  it("lets staff see the people and the overview, without adding, removing or settings", async () => {
    workspace.mockReturnValue(org("approved", "ASSISTANT"));
    get.mockImplementation((url: string) =>
      url.endsWith("/members")
        ? Promise.resolve({ data: { payload: members } })
        : url.endsWith("/organizations/org-1")
          ? Promise.resolve({ data: { payload: { id: "org-1", name: "Green School", status: "approved", teachers_count: 2, students_count: 1, classes_count: 3, exams_count: 0 } } })
          : Promise.reject(new Error(`unexpected GET ${url}`)),
    );
    renderApp(<OrganizationStudents />);
    const table = await screen.findByRole("table");
    expect(within(table).getByText("Student Three")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Add student" })).toBeNull();
    expect(within(table).queryByRole("button", { name: "Remove" })).toBeNull();
    cleanup();
    renderApp(<OrganizationOverview />);
    expect(await screen.findByText("Green School")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Start setup" })).toBeNull();
    expect(screen.queryByLabelText(/language/i)).toBeNull();
    expect(get).not.toHaveBeenCalledWith(expect.stringMatching(/\/setup$/));
  });

  it("lets admins add teachers", async () => {
    workspace.mockReturnValue(org("approved", "ADMIN"));
    get.mockResolvedValue({ data: { payload: members } });
    renderApp(<OrganizationTeachers />);
    await screen.findByRole("table");
    expect(screen.getByRole("button", { name: "Add teacher" })).toBeTruthy();
  });
});

describe("subjects", () => {
  it("asks before deleting a subject", async () => {
    get.mockResolvedValue({ data: { payload: [{ id: "s1", name: "Physics", code: "PHY-09", classes: [] }] } });
    del.mockResolvedValue({});
    renderApp(<OrganizationSubjects />);
    fireEvent.click((await screen.findAllByRole("button", { name: "Delete" }))[0]);
    const dialog = await screen.findByRole("dialog", { name: "Delete Physics?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(del).toHaveBeenCalledWith(expect.stringMatching(/\/subjects\/s1$/)));
  });

  it("needs both a name and a code", async () => {
    get.mockResolvedValue({ data: { payload: [] } });
    renderApp(<OrganizationSubjects />);
    fireEvent.click(await screen.findByRole("button", { name: "Create subject" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/Subject name/), { target: { value: "Physics" } });
    fireEvent.submit(dialog.querySelector("form")!);
    expect(await screen.findByText("Name and code needed")).toBeTruthy();
    expect(post).not.toHaveBeenCalled();
  });
});
