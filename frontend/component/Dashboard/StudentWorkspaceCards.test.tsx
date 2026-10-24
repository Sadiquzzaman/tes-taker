import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/i18n/test-utils";
import StudentWorkspaceCards from "./StudentWorkspaceCards";

const push = vi.fn();
const selectContext = vi.fn(async () => ({ href: "/classes" }));
const workspaceState = {
  loading: false,
  workspace: { type: "organization", id: "org-1" },
  selectContext,
  contexts: [
    { key: "o1", type: "organization", organization_id: "org-1", member_role: "STUDENT", actionable: true, label: "ABC School", organization_public_id: "100234", organization_status: "approved" },
    { key: "o2", type: "organization", organization_id: "org-2", member_role: "STUDENT", actionable: true, label: "New Academy", organization_status: "pending" },
    { key: "t1", type: "individual_teacher", teacher_id: "t-1", actionable: true, label: "Mr. Karim" },
    { key: "x", type: "organization", organization_id: "org-3", member_role: "TEACHER", actionable: true, label: "Not a student here" },
  ],
};

vi.mock("@/hooks/organization/useWorkspace", () => ({ default: () => workspaceState }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

afterEach(() => cleanup());

describe("student home", () => {
  it("lists only the workspaces where the user is a student", () => {
    renderWithIntl(<StudentWorkspaceCards />);
    expect(screen.getByText("ABC School")).toBeTruthy();
    expect(screen.getByText("ID 100234 · Organisation")).toBeTruthy();
    expect(screen.getByText("Teacher / coaching classes")).toBeTruthy();
    expect(screen.queryByText("Not a student here")).toBeNull();
  });

  it("marks the current workspace and blocks ones still pending approval", () => {
    renderWithIntl(<StudentWorkspaceCards />);
    expect(screen.getByRole("button", { name: /ABC School/ }).getAttribute("aria-current")).toBe("true");
    expect((screen.getByRole("button", { name: /New Academy/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("opens a workspace", async () => {
    renderWithIntl(<StudentWorkspaceCards />);
    fireEvent.click(screen.getByRole("button", { name: /Mr. Karim/ }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/classes"));
  });

  it("is in Bangla on a Bangla page", () => {
    renderWithIntl(<StudentWorkspaceCards />, "bn");
    expect(screen.getByText("আইডি 100234 · প্রতিষ্ঠান")).toBeTruthy();
  });
});
