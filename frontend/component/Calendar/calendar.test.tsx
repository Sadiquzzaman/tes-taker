import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/i18n/test-utils";
import sidebarList from "@/utils/sidebarList";
import { hourRange, layoutDay, rangeOf, shift, weekStart } from "./calendarDates";
import CalendarPage from "./CalendarPage";

const get = vi.fn();
const post = vi.fn();
const patch = vi.fn();
const del = vi.fn();
let memberRole: string | undefined = "OWNER";
vi.mock("@/lib/authSession", () => ({ getStoredUser: () => ({ id: "me", role: memberRole === "STUDENT" ? "STUDENT" : "TEACHER", access_token: "token" }), clearAuthSession: vi.fn() }));
vi.mock("@/hooks/organization/useWorkspace", () => ({ default: () => ({ memberRole, isIndividual: false, organizationId: "org1", contextType: "organization" }) }));
vi.mock("@/lib/axios", () => ({
  default: {
    get: (...args: unknown[]) => get(...args),
    post: (...args: unknown[]) => post(...args),
    patch: (...args: unknown[]) => patch(...args),
    delete: (...args: unknown[]) => del(...args),
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/calendar" }));
vi.mock("@/utils/schoolDate", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/utils/schoolDate")>()), todayInSchool: () => "2026-11-07" }));

const ok = <T,>(payload: T) => Promise.resolve({ data: { payload } });

const HERE = { key: "org:org1", label: "Demo School" };
const ITEMS: CalendarFeedItem[] = [
  { kind: "HOLIDAY", id: "closed:2026-11-08", date: "2026-11-08", title: "Founders day", reason: "HOLIDAY" },
  {
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
    role: "STUDENT",
    status: "UPCOMING",
    workspace: HERE,
  },
  { kind: "EVENT", id: "e1", starts_at: "2026-11-09T03:00:00.000Z", ends_at: "2026-11-09T09:00:00.000Z", title: "Sports day", event_type: "ACTIVITY", place: "Field", cancelled: false, workspace: HERE },
  { kind: "EXAM", id: "x1", starts_at: "2026-11-10T04:00:00.000Z", ends_at: "2026-11-10T05:00:00.000Z", title: "Unit test 1", class_name: "Class 6", workspace: HERE },
  { kind: "HOMEWORK", id: "h1", starts_at: "2026-11-07T12:00:00.000Z", ends_at: "2026-11-07T12:00:00.000Z", title: "Chapter 3", subject: "Math", sections: ["Class 6 A"], handed_in: false, workspace: HERE },
];
const EVENT: CalendarEventItem = {
  id: "e1",
  type: "ACTIVITY",
  title: "Sports day",
  description: "Bring water",
  starts_at: "2026-11-09T03:00:00.000Z",
  ends_at: "2026-11-09T09:00:00.000Z",
  place: "Field",
  whole_org: true,
  status: "SCHEDULED",
  sections: [],
  people: [],
  created_by: { id: "o1", full_name: "Owner" },
  cancelled_at: null,
  can_edit: true,
};

const serve = (items: CalendarFeedItem[] = ITEMS, workspaces: CalendarWorkspace[] = [HERE], link = { active: false, created_at: null as string | null }) =>
  get.mockImplementation((url: string, config?: { params?: { from?: string; to?: string } }) => {
    if (url.endsWith("/calendar/me")) return ok({ from: config?.params?.from, to: config?.params?.to, time_zone: "Asia/Dhaka", items, workspaces });
    if (url.endsWith("/calendar/ical-link")) return ok(link);
    if (url.endsWith("/reminders"))
      return ok({ defaults: { CLASS: [], EXAM: [], EVENT: [] }, mine: { CLASS: { offsets: [], own: false }, EXAM: { offsets: [], own: false }, EVENT: { offsets: [], own: false } }, can_manage: false });
    if (url.endsWith("/events/e1")) return ok(EVENT);
    if (url.endsWith("/routine")) return ok({ sections: [{ id: "sa", name: "A", class_name: "Class 6" }] });
    if (url.endsWith("/organizations/org1/assignable-teachers")) return ok([{ id: "m1", role: "TEACHER", user: { id: "t1", full_name: "Rina", email: null, phone: null } }]);
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });

beforeEach(() => {
  memberRole = "OWNER";
  for (const mock of [get, post, patch, del]) mock.mockReset();
});
afterEach(() => cleanup());

describe("calendar dates", () => {
  it("shows whole school weeks, Saturday first, around a month, a week or a day", () => {
    expect(weekStart("2026-11-07")).toBe("2026-11-07");
    expect(weekStart("2026-11-12")).toBe("2026-11-07");
    expect(rangeOf("month", "2026-11-18")).toEqual({ from: "2026-10-31", to: "2026-12-04" });
    expect(rangeOf("week", "2026-11-12")).toEqual({ from: "2026-11-07", to: "2026-11-13" });
    expect(rangeOf("day", "2026-11-12")).toEqual({ from: "2026-11-12", to: "2026-11-12" });
    expect(shift("month", "2026-01-31", -1)).toBe("2025-12-01");
    expect(shift("week", "2026-11-07", 1)).toBe("2026-11-14");
  });

  it("places overlapping items side by side on the hour grid, and widens the hours to fit", () => {
    const at = (time: string) => `2026-11-07T${time}:00.000Z`;
    // Dhaka is UTC+6: 04:00Z is 10:00.
    const placed = layoutDay(
      [
        { id: "a", starts_at: at("04:00"), ends_at: at("04:45") },
        { id: "b", starts_at: at("04:30"), ends_at: at("05:30") },
        { id: "c", starts_at: at("05:45"), ends_at: at("05:45") },
        { id: "d", starts_at: at("16:00"), ends_at: at("17:00") },
      ],
      "Asia/Dhaka",
    );
    expect(placed.map(({ item, start, end, column, columns }) => [item.id, start, end, column, columns])).toEqual([
      ["a", 600, 645, 0, 2],
      ["b", 630, 690, 1, 2],
      ["c", 705, 735, 0, 1],
      ["d", 1320, 1380, 0, 1],
    ]);
    expect(hourRange(placed)).toEqual({ first: 7, last: 23 });
    expect(hourRange([])).toEqual({ first: 7, last: 18 });
  });
});

describe("calendar page (CAL-07)", () => {
  it("shows the month with the chosen day's list beside it, from every workspace", async () => {
    serve();
    renderApp(<CalendarPage />);
    const panel = within(await screen.findByRole("region", { name: "Saturday 7 November" }));
    expect(get).toHaveBeenCalledWith(expect.stringMatching(/\/calendar\/me$/), { params: { from: "2026-10-31", to: "2026-12-04" } });
    expect(panel.getByRole("button", { name: "Class: Math · Class 6 A at 10:00" })).toBeTruthy();
    expect(panel.getByText("Rina · Room 201")).toBeTruthy();
    expect(panel.getByRole("button", { name: "Homework: Due: Chapter 3 at 18:00" })).toBeTruthy();
    expect(panel.getByText("Not handed in yet")).toBeTruthy();

    // A day is one button: its classes as a count, the rest by name.
    const saturday = screen.getByRole("button", { name: "Saturday 7 November: 1 class, Due: Chapter 3" });
    expect(saturday.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Sunday 8 November: Founders day" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Monday 9 November/ }));
    expect(within(screen.getByRole("region", { name: "Monday 9 November" })).getByRole("button", { name: "Event: Sports day at 09:00" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /^Tuesday 10 November/ }));
    expect(screen.getByRole("button", { name: "Exam: Unit test 1 at 10:00" })).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Exams"));
    expect(screen.queryByRole("button", { name: "Exam: Unit test 1 at 10:00" })).toBeNull();
    expect(screen.getByText("Nothing on this day.")).toBeTruthy();
    // One workspace: no workspace filter, no workspace names.
    expect(screen.queryByLabelText("Workspace")).toBeNull();
  });

  it("puts a week and a day on an hour grid, and opens a class's details", async () => {
    serve();
    renderApp(<CalendarPage />);
    await screen.findByRole("region", { name: "Saturday 7 November" });
    fireEvent.click(screen.getByRole("button", { name: "Week" }));
    await waitFor(() => expect(get).toHaveBeenCalledWith(expect.stringMatching(/\/calendar\/me$/), { params: { from: "2026-11-07", to: "2026-11-13" } }));
    const saturday = within(await screen.findByRole("region", { name: "Saturday 7 November" }));
    const lesson = saturday.getByRole("button", { name: "Class: Math · Class 6 A at 10:00" });
    // 10:00 is three hours below the 07:00 top line.
    expect(lesson.style.top).toBe(`${3 * 48 + 1}px`);
    expect(screen.getByText("All day")).toBeTruthy();

    fireEvent.click(lesson);
    const drawer = within(await screen.findByRole("dialog", { name: "Math · Class 6 A" }));
    expect(drawer.getByText("Rina")).toBeTruthy();
    expect(drawer.getByText("Room 201")).toBeTruthy();
    expect(drawer.getByText("Upcoming")).toBeTruthy();
    expect(drawer.getByRole("link", { name: "See it in the Routine" }).getAttribute("href")).toBe("/routine?section=sa");
    fireEvent.click(drawer.getByRole("button", { name: "Close" }));

    fireEvent.click(screen.getByRole("button", { name: "Open Monday 9 November" }));
    expect(await screen.findByRole("heading", { name: /Monday,? 9 November 2026/ })).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Monday 9 November" })).getByRole("button", { name: "Event: Sports day at 09:00" })).toBeTruthy();
  });

  it("opens a homework's details with a link to it", async () => {
    serve();
    renderApp(<CalendarPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Homework: Due: Chapter 3 at 18:00" }));
    const drawer = within(await screen.findByRole("dialog", { name: "Due: Chapter 3" }));
    expect(drawer.getByText("Class 6 A")).toBeTruthy();
    expect(drawer.getByRole("link", { name: "Open the homework" }).getAttribute("href")).toBe("/homework/h1");
  });

  it("names the workspace of each item when there are several, and filters by workspace", async () => {
    const other = { key: "org:org2", label: "Second School" };
    serve([...ITEMS, { kind: "EVENT", id: "e2", starts_at: "2026-11-07T08:00:00.000Z", ends_at: "2026-11-07T09:00:00.000Z", title: "Staff meeting", event_type: "MEETING", place: null, cancelled: false, workspace: other }], [ITEMS[1].workspace!, other]);
    renderApp(<CalendarPage />);
    const panel = within(await screen.findByRole("region", { name: "Saturday 7 November" }));
    expect(panel.getByText("Rina · Room 201 · Demo School")).toBeTruthy();
    // An event of another workspace opens read-only, without asking this workspace for it.
    fireEvent.click(panel.getByRole("button", { name: "Event: Staff meeting at 14:00" }));
    const drawer = within(await screen.findByRole("dialog", { name: "Staff meeting" }));
    expect(drawer.getByText("This is in Second School. Switch to that workspace to open it.")).toBeTruthy();
    expect(get).not.toHaveBeenCalledWith(expect.stringMatching(/\/events\/e2$/));
    fireEvent.click(drawer.getByRole("button", { name: "Close" }));

    fireEvent.change(screen.getByLabelText("Workspace"), { target: { value: "org:org2" } });
    expect(panel.queryByRole("button", { name: "Class: Math · Class 6 A at 10:00" })).toBeNull();
    expect(panel.getByRole("button", { name: "Event: Staff meeting at 14:00" })).toBeTruthy();
  });

  it("opens an event, and adds one on the chosen day for chosen sections and teachers", async () => {
    serve();
    post.mockReturnValue(ok(EVENT));
    renderApp(<CalendarPage />);
    fireEvent.click(await screen.findByRole("button", { name: /^Monday 9 November/ }));
    fireEvent.click(screen.getByRole("button", { name: "Event: Sports day at 09:00" }));
    let drawer = within(await screen.findByRole("dialog"));
    expect(await drawer.findByText("Bring water")).toBeTruthy();
    expect(drawer.getByText("Place: Field")).toBeTruthy();
    expect(drawer.getByText("For everyone in the organisation")).toBeTruthy();
    fireEvent.click(drawer.getByRole("button", { name: "Close" }));

    fireEvent.click(screen.getByRole("button", { name: "Add event" }));
    drawer = within(await screen.findByRole("dialog", { name: "Add an event" }));
    fireEvent.change(drawer.getByLabelText("Type"), { target: { value: "PARENT_MEETING" } });
    fireEvent.change(drawer.getByLabelText("Title"), { target: { value: " Parent meeting " } });
    fireEvent.change(drawer.getByLabelText("Place"), { target: { value: "Hall" } });
    fireEvent.click(await drawer.findByLabelText("Class 6 A"));
    fireEvent.click(await drawer.findByLabelText("Rina"));
    fireEvent.click(drawer.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post.mock.calls[0][0]).toMatch(/\/events$/);
    expect(post.mock.calls[0][1]).toEqual({
      type: "PARENT_MEETING",
      title: "Parent meeting",
      description: null,
      starts_at: "2026-11-09T04:00:00.000Z",
      ends_at: "2026-11-09T05:00:00.000Z",
      place: "Hall",
      whole_org: false,
      section_ids: ["sa"],
      user_ids: ["t1"],
    });
    expect(await screen.findByText("Calendar saved")).toBeTruthy();
  });

  it("explains a refused event and asks for a title", async () => {
    serve();
    post.mockRejectedValue({ response: { status: 400, data: { code: "EVENT_NO_ATTENDEES" } } });
    renderApp(<CalendarPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Add event" }));
    const drawer = within(await screen.findByRole("dialog", { name: "Add an event" }));
    fireEvent.click(drawer.getByRole("button", { name: "Save" }));
    expect(await drawer.findByText("Give the event a title.")).toBeTruthy();
    fireEvent.change(drawer.getByLabelText("Title"), { target: { value: "Meeting" } });
    fireEvent.click(drawer.getByRole("button", { name: "Save" }));
    expect(await drawer.findByText("Choose who attends.")).toBeTruthy();
  });

  it("keeps reminders and the private calendar link in Settings", async () => {
    serve();
    post.mockReturnValue(ok({ path: "/calendar/ical/abc.ics", created_at: "2026-11-07T04:00:00.000Z" }));
    del.mockReturnValue(ok(null));
    renderApp(<CalendarPage />);
    await screen.findByRole("region", { name: "Saturday 7 November" });
    expect(screen.queryByRole("button", { name: "Make my link" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Reminders and link" }));
    const settings = within(await screen.findByRole("dialog", { name: "Calendar settings" }));
    expect(await settings.findByRole("heading", { name: "My reminders" })).toBeTruthy();
    fireEvent.click(await settings.findByRole("button", { name: "Make my link" }));
    const field = (await settings.findByLabelText("Your private link")) as HTMLInputElement;
    expect(field.value).toMatch(/\/calendar\/ical\/abc\.ics$/);
    fireEvent.click(settings.getByRole("button", { name: "Turn off" }));
    const confirm = within(await screen.findByRole("dialog", { name: "Turn off your calendar link?" }));
    fireEvent.click(confirm.getByRole("button", { name: "Turn off" }));
    await waitFor(() => expect(del).toHaveBeenCalledWith(expect.stringMatching(/\/calendar\/ical-link$/)));
    expect(await settings.findByText("You have no link yet.")).toBeTruthy();
  });

  it("lets students see their calendar without adding events, in Bangla too", async () => {
    memberRole = "STUDENT";
    serve();
    renderApp(<CalendarPage />, { locale: "bn" });
    expect(await screen.findByRole("heading", { name: "ক্যালেন্ডার" })).toBeTruthy();
    await screen.findByText("জমা দেওয়া হয়নি", { exact: false });
    expect(screen.queryByRole("button", { name: "ইভেন্ট যোগ করুন" })).toBeNull();
  });
});

describe("menu", () => {
  it("puts Calendar under Academics for staff, solo teachers and students, only with the calendar feature", () => {
    const items = sidebarList.filter((entry) => entry.route === "/calendar");
    expect(items).toHaveLength(3);
    expect(items.every((entry) => entry.feature === "calendar" && entry.group === "academics")).toBe(true);
  });
});
