import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/i18n/test-utils";
import AttendanceWorkspaceGate from "./AttendanceWorkspaceGate";

const push = vi.fn();
const reload = vi.fn();
const selectContext = vi.fn(async () => ({ href: "/classes" }));
const workspaceState = {
  loading: false,
  workspace: { type: "individual" },
  selectContext,
  contexts: [
    { key: "o1", type: "organization", organization_id: "org-1", member_role: "STUDENT", actionable: true, label: "ABC School", organization_status: "approved" },
  ],
};

vi.mock("@/hooks/organization/useWorkspace", () => ({ default: () => workspaceState }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

const signIn = (user: Record<string, unknown>) => localStorage.setItem("user", JSON.stringify({ id: "u1", full_name: "Rahim", ...user }));
const page = (locale: "en" | "bn" = "en") =>
  renderWithIntl(
    <AttendanceWorkspaceGate page="myAttendance">
      <p>Attendance page</p>
    </AttendanceWorkspaceGate>,
    locale,
  );

/** Found in the P3 beta walkthrough: a student who had not chosen a workspace saw "Couldn't load your attendance". */
describe("attendance workspace gate", () => {
  beforeEach(() => {
    localStorage.clear();
    push.mockReset();
    reload.mockReset();
    selectContext.mockClear();
    Object.defineProperty(window, "location", { configurable: true, value: { ...window.location, pathname: "/my-attendance", reload } });
  });
  afterEach(() => cleanup());

  it("shows a student without a workspace where they study instead of the page", async () => {
    signIn({ role: "STUDENT", session_mode: "individual" });
    page();
    expect(await screen.findByText("Choose where you study")).toBeTruthy();
    expect(screen.getByText("ABC School")).toBeTruthy();
    expect(screen.queryByText("Attendance page")).toBeNull();
  });

  it("stays on the same page after the student chooses a workspace", async () => {
    signIn({ role: "STUDENT", session_mode: "individual" });
    page();
    fireEvent.click(await screen.findByRole("button", { name: /ABC School/ }));
    await waitFor(() => expect(reload).toHaveBeenCalled());
    expect(selectContext).toHaveBeenCalledWith(expect.objectContaining({ key: "o1" }));
    expect(push).not.toHaveBeenCalled();
  });

  it("shows the page to a student inside a workspace and to a solo teacher in their own", async () => {
    signIn({ role: "STUDENT", session_mode: "organization", organization: { id: "org-1", name: "ABC School" } });
    page();
    expect(await screen.findByText("Attendance page")).toBeTruthy();
    cleanup();
    signIn({ role: "TEACHER", session_mode: "individual", context_type: "personal_teacher" });
    page();
    expect(await screen.findByText("Attendance page")).toBeTruthy();
  });

  it("explains it in Bangla", async () => {
    signIn({ role: "STUDENT", session_mode: "individual" });
    page("bn");
    expect(await screen.findByText("কোথায় পড়েন তা বেছে নিন")).toBeTruthy();
  });
});
