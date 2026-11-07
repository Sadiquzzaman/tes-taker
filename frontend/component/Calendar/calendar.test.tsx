import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/i18n/test-utils";
import sidebarList from "@/utils/sidebarList";
import { rangeOf, shift, weekStart } from "./calendarDates";
import CalendarPage from "./CalendarPage";

const get = vi.fn();
const post = vi.fn();
const patch = vi.fn();
const del = vi.fn();
let memberRole: string | undefined = "OWNER";
vi.mock("@/lib/authSession", () => ({ getStoredUser: () => ({ id: "me", role: memberRole === "STUDENT" ? "STUDENT" : "TEACHER", access_token: "token" }), clearAuthSession: vi.fn() }));
vi.mock("@/hooks/organization/useWorkspace", () => ({ default: () => ({ memberRole, isIndividual: false, organizationId: "org1" }) }));
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
  },
  { kind: "EVENT", id: "e1", starts_at: "2026-11-09T03:00:00.000Z", ends_at: "2026-11-09T09:00:00.000Z", title: "Sports day", event_type: "ACTIVITY", place: "Field", cancelled: false },
  { kind: "EXAM", id: "x1", starts_at: "2026-11-10T04:00:00.000Z", ends_at: "2026-11-10T05:00:00.000Z", title: "Unit test 1", class_name: "Class 6" },
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

const serve = (event: CalendarEventItem = EVENT, link = { active: false, created_at: null as string | null }) =>
  get.mockImplementation((url: string, config?: { params?: { from?: string; to?: string } }) => {
    if (url.endsWith("/calendar/feed")) return ok({ from: config?.params?.from, to: config?.params?.to, time_zone: "Asia/Dhaka", items: ITEMS });
    if (url.endsWith("/calendar/ical-link")) return ok(link);
    if (url.endsWith("/events/e1")) return ok(event);
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
});

describe("calendar page (CAL-07)", () => {
  it("shows the month's classes, events, exams and holidays, and filters them", async () => {
    serve();
    renderApp(<CalendarPage />);
    expect(await screen.findByRole("button", { name: "Class: Math · Class 6 A at 10:00" })).toBeTruthy();
    expect(get).toHaveBeenCalledWith(expect.stringMatching(/\/calendar\/feed$/), { params: { from: "2026-10-31", to: "2026-12-04" } });
    expect(screen.getByRole("button", { name: "Event: Sports day at 09:00" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Exam: Unit test 1 at 10:00" })).toBeTruthy();
    expect(screen.getByText("Founders day")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Exams"));
    expect(screen.queryByRole("button", { name: "Exam: Unit test 1 at 10:00" })).toBeNull();

    // The week view lists each day; a class opens its day.
    fireEvent.click(screen.getByRole("button", { name: "Week" }));
    await waitFor(() => expect(get).toHaveBeenCalledWith(expect.stringMatching(/\/calendar\/feed$/), { params: { from: "2026-11-07", to: "2026-11-13" } }));
    const saturday = within(await screen.findByRole("region", { name: "Saturday" }));
    expect(saturday.getByText("Rina · Room 201")).toBeTruthy();
    fireEvent.click(saturday.getByRole("button", { name: /Math · Class 6 A/ }));
    expect(await screen.findByRole("heading", { name: /Saturday,? 7 November 2026/ })).toBeTruthy();
  });

  it("opens an event, and adds one for chosen sections and teachers", async () => {
    serve();
    post.mockReturnValue(ok(EVENT));
    renderApp(<CalendarPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Event: Sports day at 09:00" }));
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
      starts_at: "2026-11-07T04:00:00.000Z",
      ends_at: "2026-11-07T05:00:00.000Z",
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

  it("makes a private calendar link, shows it once, and turns it off", async () => {
    serve();
    post.mockReturnValue(ok({ path: "/calendar/ical/abc.ics", created_at: "2026-11-07T04:00:00.000Z" }));
    del.mockReturnValue(ok(null));
    renderApp(<CalendarPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Make my link" }));
    const field = (await screen.findByLabelText("Your private link")) as HTMLInputElement;
    expect(field.value).toMatch(/\/calendar\/ical\/abc\.ics$/);
    fireEvent.click(screen.getByRole("button", { name: "Turn off" }));
    const confirm = within(await screen.findByRole("dialog", { name: "Turn off your calendar link?" }));
    fireEvent.click(confirm.getByRole("button", { name: "Turn off" }));
    await waitFor(() => expect(del).toHaveBeenCalledWith(expect.stringMatching(/\/calendar\/ical-link$/)));
    expect(await screen.findByText("You have no link yet.")).toBeTruthy();
  });

  it("lets students see their calendar without adding events, in Bangla too", async () => {
    memberRole = "STUDENT";
    serve();
    renderApp(<CalendarPage />, { locale: "bn" });
    expect(await screen.findByRole("heading", { name: "ক্যালেন্ডার" })).toBeTruthy();
    await screen.findByText("Founders day");
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
