import { act, cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/i18n/test-utils";
import { durationMessage } from "@/utils/Dashboard/format";
import { monthGrid, todayInTimeZone, weekDayNames } from "@/utils/Dashboard/calendar";
import Calendar from "./Calendar";
import DashboardPageContent from "./DashboardPageContent";
import LiveTest from "./LiveTest";
import MyActivity from "./MyActivity";
import NeedsMarking from "./NeedsMarking";
import StartingSoon from "./StartingSoon";
import TopStudents from "./TopStudents";
import UpcomingTests from "./UpcomingTests";

const PAYLOAD: TeacherDashboardPayload = {
  pending_grading_count: 3,
  live_tests: [
    { id: "l1", test_name: "Physics quiz", class_name: "9A", participant_count: 30, submitted_count: 12, remaining_seconds: 125, exam_end_time: "" },
    { id: "l2", test_name: "Chemistry quiz", class_name: "9B", participant_count: 20, submitted_count: 5, remaining_seconds: 600, exam_end_time: "" },
  ],
  students_summary: { total: 50, joined: 45, pending: 5, active: 40 },
  upcoming_tests: [
    { id: "u1", test_name: "Algebra", class_name: "9A", exam_start_time: "2026-10-26T04:30:00.000Z", duration_minutes: 90, student_count: 32 },
    { id: "u2", test_name: null, class_name: null, exam_start_time: "2026-10-27T04:30:00.000Z", duration_minutes: 45, student_count: 0 },
  ],
  classes_summary: [{ id: "c1", name: "9A", student_count: 32 }],
  top_students_by_class: [
    {
      class_id: "c1",
      class_name: "9A",
      students: [
        { student_id: "s1", name: "Arif", tests_taken: 3, avg_score_percent: 71.4 },
        { student_id: "s2", name: "Nadia", tests_taken: 4, avg_score_percent: 92.6 },
        { student_id: "s3", name: "Rafi", tests_taken: 1, avg_score_percent: null },
      ],
    },
    { class_id: "c2", class_name: "9B", students: [{ student_id: "s4", name: "Tasnim", tests_taken: 2, avg_score_percent: 80 }] },
  ],
  calendar_events: [{ year: 2026, month: 10, day: 26, test_count: 2 }],
  activity: { period: "monthly", data: [{ label: "Oct", exam_count: 2, participant_count: 40 }] },
};

const dashboard = {
  data: PAYLOAD as TeacherDashboardPayload | null,
  loading: false,
  error: null as string | null,
  refetch: vi.fn(),
  activityPeriod: "monthly" as DashboardActivityPeriod,
  setActivityPeriod: vi.fn(),
  calendarYear: 2026,
  calendarMonth: 10,
  setCalendarMonth: vi.fn(),
  setCalendarYear: vi.fn(),
};

vi.mock("@/context/DashboardContext", () => ({
  useDashboard: () => dashboard,
  DashboardProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/lib/authSession", () => ({ getStoredUser: () => ({ role: "TEACHER" }) }));
vi.mock("@/component/Tests/CreateTestActionButton", () => ({ default: () => <button type="button">Create test</button> }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

beforeEach(() => {
  Object.assign(dashboard, { data: PAYLOAD, loading: false, error: null });
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Today strip", () => {
  it("highlights work to mark and links to grading", () => {
    renderWithIntl(<NeedsMarking />);
    expect(screen.getByText("3 submissions waiting for review.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Go to marking" }).getAttribute("href")).toBe("/grading");
  });

  it("says so calmly when nothing needs marking, in Bangla too", () => {
    dashboard.data = { ...PAYLOAD, pending_grading_count: 0 };
    renderWithIntl(<NeedsMarking />, "bn");
    expect(screen.getByText("০")).toBeTruthy();
    expect(screen.getByText("পর্যালোচনার জন্য কিছু অপেক্ষায় নেই।")).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("shows the live test with a ticking countdown and pages through live tests", () => {
    vi.useFakeTimers();
    renderWithIntl(<LiveTest />);

    expect(screen.getByText("Physics quiz")).toBeTruthy();
    expect(screen.getByText("02:05 left")).toBeTruthy();
    expect(screen.getByText("30 taking it · 12 submitted")).toBeTruthy();
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByText("02:00 left")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Next live test" }));
    expect(screen.getByText("Chemistry quiz")).toBeTruthy();
    expect(screen.getByText("2 of 2")).toBeTruthy();
  });

  it("offers to create a test when nothing is live", () => {
    dashboard.data = { ...PAYLOAD, live_tests: [] };
    renderWithIntl(<LiveTest />);
    expect(screen.getByText("No test is running right now.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Create test" }).getAttribute("href")).toBe("/tests/create");
  });

  it("shows the next test's start in Dhaka time", () => {
    renderWithIntl(<StartingSoon />);
    expect(screen.getByText("Algebra")).toBeTruthy();
    // 04:30 UTC is 10:30 in Dhaka.
    expect(screen.getByText("26 Oct 2026, 10:30 · 9A")).toBeTruthy();
  });

  it("shows placeholders while loading", () => {
    dashboard.loading = true;
    const { container } = renderWithIntl(<NeedsMarking />);
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
  });
});

describe("Upcoming tests", () => {
  it("lists tests with their duration and falls back for missing names", () => {
    renderWithIntl(<UpcomingTests />);
    const table = screen.getByRole("table", { name: "Upcoming tests" });
    expect(within(table).getByText("1 h 30 min")).toBeTruthy();
    expect(within(table).getByText("45 min")).toBeTruthy();
    expect(within(table).getByText("Untitled test")).toBeTruthy();
  });

  it("shows an empty state with a next step", () => {
    dashboard.data = { ...PAYLOAD, upcoming_tests: [] };
    renderWithIntl(<UpcomingTests />);
    expect(screen.getAllByText("No upcoming tests").length).toBeGreaterThan(0);
  });

  it("writes durations in Bangla", () => {
    renderWithIntl(<UpcomingTests />, "bn");
    expect(within(screen.getByRole("table")).getByText("১ ঘণ্টা ৩০ মিনিট")).toBeTruthy();
  });
});

describe("Top students", () => {
  const names = () =>
    within(screen.getByRole("table"))
      .getAllByRole("row")
      .slice(1)
      .map((row) => within(row).getAllByRole("cell")[0].textContent);

  it("lists the best average first, with rounded percentages", () => {
    renderWithIntl(<TopStudents />);
    expect(names()).toEqual(["Nadia", "Arif", "Rafi"]);
    expect(within(screen.getByRole("table")).getByText("93%")).toBeTruthy();
  });

  it("searches and switches class", () => {
    renderWithIntl(<TopStudents />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "ari" } });
    expect(names()).toEqual(["Arif"]);

    fireEvent.change(screen.getByRole("combobox", { name: "Class" }), { target: { value: "c2" } });
    expect(names()).toEqual(["Tasnim"]);
  });
});

describe("Calendar and activity", () => {
  it("marks days with tests for screen readers and moves across the year boundary", () => {
    dashboard.calendarMonth = 1;
    dashboard.data = { ...PAYLOAD, calendar_events: [{ year: 2026, month: 1, day: 26, test_count: 2 }] };
    renderWithIntl(<Calendar />);

    expect(screen.getByText("2 tests")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    expect(dashboard.setCalendarYear).toHaveBeenCalledWith(2025);
    expect(dashboard.setCalendarMonth).toHaveBeenCalledWith(12);
    dashboard.calendarMonth = 10;
  });

  it("names the month and weekdays in Bangla", () => {
    renderWithIntl(<Calendar />, "bn");
    expect(screen.getByText("অক্টোবর ২০২৬", { selector: "span" })).toBeTruthy();
    expect(weekDayNames("bn")[0]).toBe("রবি");
  });

  it("asks the API for another period", () => {
    renderWithIntl(<MyActivity />);
    fireEvent.change(screen.getByRole("combobox", { name: "Period" }), { target: { value: "weekly" } });
    expect(dashboard.setActivityPeriod).toHaveBeenCalledWith("weekly");
  });
});

describe("Dashboard page", () => {
  it("puts Today first, then the overview", () => {
    renderWithIntl(<DashboardPageContent />);
    const today = screen.getByRole("region", { name: "Today" });
    expect(within(today).getByText("Needs marking")).toBeTruthy();
    expect(within(today).getByText("Live now")).toBeTruthy();
    expect(within(today).getByText("Starting soon")).toBeTruthy();
  });

  it("offers a retry when the dashboard fails to load", () => {
    Object.assign(dashboard, { data: null, error: "Network Error" });
    renderWithIntl(<DashboardPageContent />);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(dashboard.refetch).toHaveBeenCalled();
  });
});

describe("dashboard helpers", () => {
  it("splits durations into hours and minutes", () => {
    expect(durationMessage(null)).toBeNull();
    expect(durationMessage(45)?.key).toBe("minutes");
    expect(durationMessage(120)).toEqual({ key: "hours", values: { hours: 2, minutes: 0 } });
    expect(durationMessage(95)).toEqual({ key: "hoursMinutes", values: { hours: 1, minutes: 35 } });
  });

  it("lays a month out in Sunday-first weeks", () => {
    // October 2026 starts on a Thursday and has 31 days.
    const weeks = monthGrid(10, 2026);
    expect(weeks[0]).toEqual([null, null, null, null, 1, 2, 3]);
    expect(weeks.flat().filter(Boolean)).toHaveLength(31);
  });

  it("reads today in Dhaka time", () => {
    // 20:00 UTC on 25 Oct is already 26 Oct in Dhaka.
    expect(todayInTimeZone(new Date("2026-10-25T20:00:00Z"))).toEqual({ day: 26, month: 10, year: 2026 });
  });
});
