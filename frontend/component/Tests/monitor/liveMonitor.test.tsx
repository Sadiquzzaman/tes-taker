import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/i18n/test-utils";
import LiveMonitor from "./LiveMonitor";

type Handler = (...args: unknown[]) => void;
const handlers = new Map<string, Handler>();
const socketEmit = vi.fn();
const fakeSocket = { connected: true, connect: vi.fn(), on: (event: string, handler: Handler) => handlers.set(event, handler), emit: socketEmit, disconnect: vi.fn(), removeAllListeners: vi.fn() };
vi.mock("socket.io-client", () => ({ io: () => fakeSocket }));
vi.mock("@/utils/tests/proctoringSocket", () => ({ getProctoringSocketUrl: () => "http://socket.test" }));
const get = vi.fn();
const post = vi.fn();
vi.mock("@/lib/axios", () => ({ default: { get: (...args: unknown[]) => get(...args), post: (...args: unknown[]) => post(...args) } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/tests/x1/monitor" }));

const ok = <T,>(payload: T) => Promise.resolve({ data: { payload } });
const session = (extra: Partial<MonitorSession> = {}): MonitorSession => ({
  studentId: "st1",
  studentName: "Mitu Das",
  liveStatus: "WRITING",
  flagCount: 0,
  totalFlagPoints: 0,
  latestFlag: null,
  deadline: new Date(Date.now() + 10 * 60_000).toISOString(),
  ...extra,
});
const timeline: MonitorTimelineEvent[] = [
  { id: "e1", type: "tab-switch", check: "proctoring_tab_switch", message: "Left", points: 1, source: "LIVE", occurred_at: "2026-11-13T05:00:00Z" },
  { id: "e2", type: "monitoring-lost", check: null, message: null, points: 0, source: "SERVER", occurred_at: "2026-11-13T05:01:00Z" },
];

beforeEach(() => {
  localStorage.setItem("user", JSON.stringify({ id: "t1", access_token: "token" }));
  handlers.clear();
  socketEmit.mockReset();
  post.mockReset();
  get.mockImplementation((url: string) =>
    url.endsWith("/proctoring/sessions")
      ? ok({ sessions: [session(), session({ studentId: "st2", studentName: "Rafi Ahmed", liveStatus: "SUBMITTED" })] })
      : url.endsWith("/timeline")
        ? ok(timeline)
        : ok({ test_name: "Physics quiz" }),
  );
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("live monitor (PRO-03, PRO-07)", () => {
  it("shows a tile per student, joins as a monitor and follows flags and lost monitoring live", async () => {
    renderApp(<LiveMonitor examId="x1" />);
    const tiles = within(await screen.findByRole("list", { name: "Students taking the test" }));
    expect(tiles.getByRole("button", { name: "Mitu Das: Writing, 0 flags" }).textContent).toMatch(/left/);
    expect(tiles.getByRole("button", { name: "Rafi Ahmed: Submitted, 0 flags" })).toBeTruthy();
    act(() => handlers.get("connect")?.());
    expect(socketEmit).toHaveBeenCalledWith("exam:join", { examId: "x1", role: "monitor" });

    act(() => handlers.get("flag:update")?.({ studentId: "st1", flagCount: 6, totalFlagPoints: 8, flag: { id: "f1", type: "phone-detected", message: "Phone", points: 3, timestamp: "2026-11-13T05:02:00Z" } }));
    const mitu = tiles.getByRole("button", { name: "Mitu Das: Writing, 6 flags" });
    expect(mitu.textContent).toContain("Phone seen");
    expect(mitu.className).toContain("border-danger");
    act(() => handlers.get("session:lost")?.({ studentId: "st1", lostSince: "2026-11-13T05:03:00Z" }));
    expect(tiles.getByRole("button", { name: "Mitu Das: Monitoring lost, 6 flags" })).toBeTruthy();
    expect(screen.getByText("0 writing · 1 monitoring lost · 1 finished")).toBeTruthy();
  });

  it("opens a student's timeline, sends a warning and ends their exam with a reason", async () => {
    post.mockReturnValue(ok(null));
    renderApp(<LiveMonitor examId="x1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Mitu Das: Writing, 0 flags" }));
    const drawer = within(await screen.findByRole("dialog", { name: "Mitu Das" }));
    expect(await drawer.findByText("Switched tab")).toBeTruthy();
    expect(drawer.getByText("Monitoring lost")).toBeTruthy();
    fireEvent.change(drawer.getByLabelText("Warning to this student"), { target: { value: "Eyes on your screen." } });
    fireEvent.click(drawer.getByRole("button", { name: "Send warning" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith(expect.stringMatching(/\/exams\/x1\/proctoring\/students\/st1\/warn$/), { message: "Eyes on your screen." }));

    fireEvent.click(drawer.getByRole("button", { name: "End this student's exam" }));
    const endButton = drawer.getByRole("button", { name: "End exam" }) as HTMLButtonElement;
    expect(endButton.disabled).toBe(true);
    fireEvent.change(drawer.getByLabelText("Reason"), { target: { value: "Talking off camera" } });
    fireEvent.click(endButton);
    await waitFor(() => expect(post).toHaveBeenCalledWith(expect.stringMatching(/\/students\/st1\/end$/), { reason: "Talking off camera" }));
    expect(await screen.findByRole("button", { name: "Mitu Das: Ended, 0 flags" })).toBeTruthy();
  });

  it("says when the teacher may not watch this test", async () => {
    get.mockImplementation((url: string) => (url.endsWith("/proctoring/sessions") ? Promise.reject({ response: { status: 403 } }) : ok({ test_name: "Physics quiz" })));
    renderApp(<LiveMonitor examId="x1" />);
    expect(await screen.findByText("You can't watch this test.")).toBeTruthy();
  });
});
