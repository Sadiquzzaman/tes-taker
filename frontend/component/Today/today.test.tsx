import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/i18n/test-utils";
import { homeForContext } from "@/lib/workspace";
import sidebarList from "@/utils/sidebarList";
import TodayPage from "./TodayPage";

const get = vi.fn();
let memberRole: string | undefined = "TEACHER";
vi.mock("@/lib/authSession", () => ({ getStoredUser: () => ({ id: "me", role: memberRole === "STUDENT" ? "STUDENT" : "TEACHER", access_token: "token" }), clearAuthSession: vi.fn() }));
vi.mock("@/hooks/organization/useWorkspace", () => ({ default: () => ({ memberRole, isIndividual: false, organizationId: "org1", contextType: "organization" }) }));
vi.mock("@/lib/axios", () => ({ default: { get: (...args: unknown[]) => get(...args) } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/today" }));
vi.mock("@/utils/schoolDate", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/utils/schoolDate")>()), todayInSchool: () => "2026-11-07" }));

const ok = <T,>(payload: T) => Promise.resolve({ data: { payload } });
const HERE = { key: "org:org1", label: "Demo School" };
const lesson = (extra: Partial<Extract<CalendarFeedItem, { kind: "CLASS" }>> = {}): CalendarFeedItem => ({
  kind: "CLASS",
  id: "slot1:2026-11-07",
  date: "2026-11-07",
  starts_at: "2026-11-07T04:00:00.000Z",
  ends_at: "2026-11-07T04:45:00.000Z",
  title: "Class 6 A",
  section: { id: "sa", name: "A", class_name: "Class 6" },
  subject: "Math",
  teacher: "Rina",
  room: "Room 201",
  role: "TEACHER",
  status: "UPCOMING",
  workspace: HERE,
  ...extra,
});
const ITEMS: CalendarFeedItem[] = [
  lesson(),
  { kind: "HOMEWORK", id: "h1", starts_at: "2099-11-09T12:00:00.000Z", ends_at: "2099-11-09T12:00:00.000Z", title: "Chapter 3", subject: "Math", sections: ["Class 6 A"], handed_in: null, workspace: HERE },
  { kind: "EVENT", id: "e1", starts_at: "2026-11-10T08:00:00.000Z", ends_at: "2026-11-10T09:00:00.000Z", title: "Parent meeting", event_type: "PARENT_MEETING", place: "Hall", cancelled: false, workspace: HERE },
  { kind: "EVENT", id: "e2", starts_at: "2026-11-11T08:00:00.000Z", ends_at: "2026-11-11T09:00:00.000Z", title: "Called off", event_type: "OTHER", place: null, cancelled: true, workspace: HERE },
];
const serve = (items: CalendarFeedItem[] = ITEMS, workspaces = [HERE]) =>
  get.mockImplementation((url: string) => (url.endsWith("/calendar/me") ? ok({ from: "2026-11-07", to: "2026-11-14", time_zone: "Asia/Dhaka", items, workspaces }) : Promise.reject(new Error(`unexpected GET ${url}`))));

beforeEach(() => {
  memberRole = "TEACHER";
  get.mockReset();
});
afterEach(() => cleanup());

describe("Today", () => {
  it("shows the day on an hour grid, homework due this week and what comes up, from the personal calendar", async () => {
    serve();
    renderApp(<TodayPage />);
    const day = within(await screen.findByRole("region", { name: "Saturday 7 November" }));
    expect(get).toHaveBeenCalledWith(expect.stringMatching(/\/calendar\/me$/), { params: { from: "2026-11-07", to: "2026-11-14" } });
    expect(day.getByRole("button", { name: "Class: Math · Class 6 A at 10:00" })).toBeTruthy();
    // Homework and events of later days are in the lists, not on today's grid.
    expect(day.queryByRole("button", { name: /Parent meeting/ })).toBeNull();
    const card = (name: string) => within(screen.getByRole("heading", { name }).closest("section") as HTMLElement);
    const due = card("Due this week");
    expect(due.getByRole("button", { name: /Due: Chapter 3/ })).toBeTruthy();
    const coming = card("Coming up");
    expect(coming.getByRole("button", { name: "Event: Parent meeting at 14:00" })).toBeTruthy();
    expect(coming.queryByText("Called off")).toBeNull();
    expect(screen.queryByText(/Check-in is open/)).toBeNull();
    // Only owners and admins get the overview link.
    expect(screen.queryByRole("link", { name: "Open the overview" })).toBeNull();

    fireEvent.click(day.getByRole("button", { name: "Class: Math · Class 6 A at 10:00" }));
    expect(await screen.findByRole("dialog", { name: "Math · Class 6 A" })).toBeTruthy();
  });

  it("says when check-in is open, and links owners to the overview", async () => {
    memberRole = "OWNER";
    serve([lesson({ status: "OPEN" })]);
    renderApp(<TodayPage />);
    expect(await screen.findByText("Check-in is open: Math · Class 6 A")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Check in" }).getAttribute("href")).toBe("/my-attendance");
    expect(screen.getByRole("link", { name: "Open the overview" }).getAttribute("href")).toBe("/organization");
    expect(screen.getByText("Nothing due this week.")).toBeTruthy();
  });

  it("explains an empty day when no workspace has the calendar, in Bangla too", async () => {
    memberRole = "STUDENT";
    serve([], []);
    renderApp(<TodayPage />, { locale: "bn" });
    expect(await screen.findByRole("heading", { name: "আজ" })).toBeTruthy();
    expect(await screen.findByText("ক্যালেন্ডার চালু হলে আপনার সময়সূচি এখানে দেখাবে")).toBeTruthy();
  });
});

describe("where people start", () => {
  it("opens every workspace on Today, and a pending organisation on its pending page", () => {
    expect(homeForContext({ type: "organization", key: "org:1", label: "School", role_label: "Teacher", member_role: "TEACHER", organization_status: "approved", actionable: true })).toBe("/today");
    expect(homeForContext({ type: "organization", key: "org:1", label: "School", role_label: "Owner", member_role: "OWNER", organization_status: "pending", actionable: true })).toBe("/organization/pending");
    expect(homeForContext({ type: "individual_teacher", key: "teacher:1", label: "Rina's Classes", role_label: "Student", actionable: true })).toBe("/today");
    expect(homeForContext({ type: "personal_teacher", key: "personal_teacher", label: "My Teaching", role_label: "Teacher", actionable: true })).toBe("/today");
  });

  it("puts Today first in the menu for everyone", () => {
    const items = sidebarList.filter((entry) => entry.route === "/today");
    expect(items.map((entry) => entry.category)).toEqual(["Platform", "Organization"]);
    expect(items[1].memberRoles).toEqual(["OWNER", "ADMIN", "ASSISTANT", "TEACHER"]);
  });
});
