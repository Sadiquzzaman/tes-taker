import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/i18n/test-utils";
import NotificationBell, { BELL_POLL_MS } from "./NotificationBell";
import NotificationPrefs from "./NotificationPrefs";

const get = vi.fn();
const post = vi.fn();
const patch = vi.fn();
const put = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => "/dashboard", useSearchParams: () => new URLSearchParams() }));
vi.mock("@/lib/axios", () => ({
  default: {
    get: (...args: unknown[]) => get(...args),
    post: (...args: unknown[]) => post(...args),
    patch: (...args: unknown[]) => patch(...args),
    put: (...args: unknown[]) => put(...args),
  },
}));

beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const item = (overrides: Partial<InboxItem> = {}): InboxItem => ({
  id: "n-1",
  type: "exam.scheduled",
  title: "New test: Algebra",
  body: "Starts 2 Nov 2026, 10:30.",
  link: "/tests",
  read_at: null,
  created_at: "2026-11-01T08:00:00.000Z",
  organization_id: "org-1",
  ...overrides,
});

const api = (count: number, items: InboxItem[]) =>
  get.mockImplementation((url: string) =>
    Promise.resolve({
      data: url.endsWith("/unread-count")
        ? { payload: { count } }
        : { payload: items, meta: { page: 1, limit: 20, total: items.length, total_pages: 1, unread: items.filter((i) => !i.read_at).length } },
    }),
  );

describe("notifications bell (FND-12)", () => {
  it("shows the unread count in Bangla and opens the inbox", async () => {
    api(3, [item(), item({ id: "n-2", title: "SMS credits running low", link: "/billing", read_at: "2026-11-01T09:00:00.000Z" })]);
    renderApp(<NotificationBell />, { locale: "bn" });

    const bell = await screen.findByRole("button", { name: "নোটিফিকেশন, ৩টি অপঠিত" });
    expect(screen.getByText("৩")).toBeTruthy();
    fireEvent.click(bell);
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("New test: Algebra")).toBeTruthy();
    expect(within(dialog).getByText("SMS credits running low")).toBeTruthy();
    expect(get.mock.calls.some(([url]) => String(url).endsWith("/me/notifications"))).toBe(true);
  });

  it("marks an item read and goes to its page", async () => {
    api(1, [item()]);
    patch.mockResolvedValue({ data: {} });
    renderApp(<NotificationBell />);
    fireEvent.click(await screen.findByRole("button", { name: "Notifications, 1 unread" }));
    fireEvent.click(await screen.findByText("New test: Algebra"));

    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1));
    expect(patch.mock.calls[0][0]).toMatch(/\/me\/notifications\/n-1\/read$/);
    expect(push).toHaveBeenCalledWith("/tests");
  });

  it("marks everything read", async () => {
    api(2, [item(), item({ id: "n-2" })]);
    post.mockResolvedValue({ data: {} });
    renderApp(<NotificationBell />);
    fireEvent.click(await screen.findByRole("button", { name: "Notifications, 2 unread" }));
    fireEvent.click(await screen.findByRole("button", { name: "Mark all as read" }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post.mock.calls[0][0]).toMatch(/\/me\/notifications\/read-all$/);
    // The bell (behind the open panel) no longer counts anything unread.
    expect(await screen.findByRole("button", { name: "Notifications", hidden: true })).toBeTruthy();
  });

  it("refreshes the badge every minute", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    api(0, []);
    renderApp(<NotificationBell />);
    await screen.findByRole("button", { name: "Notifications" });
    api(4, []);
    await act(async () => {
      vi.advanceTimersByTime(BELL_POLL_MS);
    });
    expect(await screen.findByRole("button", { name: "Notifications, 4 unread" })).toBeTruthy();
  });
});

describe("notification settings (FND-12)", () => {
  it("lets the user turn SMS or email on or off; in-app is always on", async () => {
    const prefs: NotificationPref[] = [
      { event_type: "exam.scheduled", channels: ["IN_APP", "SMS"], allowed: ["IN_APP", "SMS", "EMAIL"] },
      { event_type: "sms.low_credit", channels: ["IN_APP", "EMAIL"], allowed: ["IN_APP", "EMAIL"] },
    ];
    get.mockResolvedValue({ data: { payload: prefs } });
    put.mockResolvedValue({ data: { payload: [{ ...prefs[0], channels: ["IN_APP", "SMS", "EMAIL"] }, prefs[1]] } });
    renderApp(<NotificationPrefs />);

    const sms = (await screen.findByLabelText("SMS for Test scheduled")) as HTMLInputElement;
    expect(sms.checked).toBe(true);
    // Low credit has no SMS option.
    expect(screen.queryByLabelText("SMS for SMS credits running low")).toBeNull();
    const email = screen.getByLabelText("Email for Test scheduled") as HTMLInputElement;
    expect(email.checked).toBe(false);

    fireEvent.click(email);
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(put.mock.calls[0][0]).toMatch(/\/me\/notification-prefs$/);
    expect(put.mock.calls[0][1]).toEqual({ event_type: "exam.scheduled", channels: ["IN_APP", "SMS", "EMAIL"] });
    await waitFor(() => expect((screen.getByLabelText("Email for Test scheduled") as HTMLInputElement).checked).toBe(true));
  });
});
