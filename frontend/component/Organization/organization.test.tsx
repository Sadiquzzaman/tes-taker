import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/i18n/test-utils";
import { OrganizationTeachers, parsePhoneList } from "./OrganizationMembers";
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
