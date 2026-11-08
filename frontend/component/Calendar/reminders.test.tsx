import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/i18n/test-utils";
import RemindersCard from "./RemindersCard";

const get = vi.fn();
const put = vi.fn();
const del = vi.fn();
vi.mock("@/lib/authSession", () => ({ getStoredUser: () => ({ id: "me", role: "TEACHER", access_token: "token" }), clearAuthSession: vi.fn() }));
vi.mock("@/lib/axios", () => ({
  default: {
    get: (...args: unknown[]) => get(...args),
    put: (...args: unknown[]) => put(...args),
    delete: (...args: unknown[]) => del(...args),
  },
}));

const ok = <T,>(payload: T) => Promise.resolve({ data: { payload } });
const settings = (extra: Partial<ReminderSettings> = {}): ReminderSettings => ({
  defaults: { CLASS: [{ minutes: 30, channel: "IN_APP" }], EXAM: [{ minutes: 60, channel: "IN_APP" }], EVENT: [{ minutes: 1440, channel: "SMS" }] },
  mine: {
    CLASS: { offsets: [{ minutes: 30, channel: "IN_APP" }], own: false },
    EXAM: { offsets: [], own: true },
    EVENT: { offsets: [{ minutes: 1440, channel: "SMS" }], own: false },
  },
  can_manage: true,
  ...extra,
});

beforeEach(() => {
  for (const mock of [get, put, del]) mock.mockReset();
});
afterEach(() => cleanup());

describe("reminders (CAL-05)", () => {
  it("shows my reminders and everyone's, and sets my class reminders", async () => {
    get.mockReturnValue(ok(settings()));
    put.mockReturnValue(ok(settings({ mine: { ...settings().mine, CLASS: { offsets: [{ minutes: 120, channel: "IN_APP" }, { minutes: 15, channel: "SMS" }], own: true } } })));
    renderApp(<RemindersCard />);
    const mine = within((await screen.findByRole("heading", { name: "My reminders" })).closest("section") as HTMLElement);
    expect((await mine.findAllByText("30 minutes before, in the app")).length).toBe(1);
    expect(mine.getByText("Off")).toBeTruthy();
    expect(mine.getAllByText("As set for everyone")).toHaveLength(2);
    expect(screen.getByRole("heading", { name: "Reminders for everyone" })).toBeTruthy();
    expect(screen.getAllByText("1 day before, by SMS").length).toBeGreaterThan(0);

    fireEvent.click(mine.getByRole("button", { name: "Change reminders for Classes" }));
    const drawer = within(await screen.findByRole("dialog", { name: "My reminders: Classes" }));
    fireEvent.change(drawer.getByLabelText("When"), { target: { value: "120" } });
    fireEvent.click(drawer.getByRole("button", { name: "Add a reminder" }));
    const whens = drawer.getAllByLabelText("When");
    fireEvent.change(whens[1], { target: { value: "120" } });
    expect(drawer.getByText("Each time can be used once.")).toBeTruthy();
    expect((drawer.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(whens[1], { target: { value: "15" } });
    fireEvent.change(drawer.getAllByLabelText("How")[1], { target: { value: "SMS" } });
    expect(drawer.getByText(/use the organisation's SMS credits/)).toBeTruthy();
    fireEvent.click(drawer.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(put.mock.calls[0][0]).toMatch(/\/reminders\/mine\/CLASS$/);
    expect(put.mock.calls[0][1]).toEqual({ offsets: [{ minutes: 120, channel: "IN_APP" }, { minutes: 15, channel: "SMS" }] });
    expect(await screen.findByText("Reminders saved")).toBeTruthy();
  });

  it("goes back to the default, turns reminders off, and changes everyone's (owners and admins)", async () => {
    get.mockReturnValue(ok(settings()));
    del.mockReturnValue(ok(settings({ mine: { ...settings().mine, EXAM: { offsets: [{ minutes: 60, channel: "IN_APP" }], own: false } } })));
    put.mockReturnValue(ok(settings()));
    renderApp(<RemindersCard />);
    fireEvent.click(await screen.findByRole("button", { name: "Use the default" }));
    await waitFor(() => expect(del).toHaveBeenCalledWith(expect.stringMatching(/\/reminders\/mine\/EXAM$/)));

    fireEvent.click(screen.getByRole("button", { name: "Change everyone's reminders for Events" }));
    const drawer = within(await screen.findByRole("dialog", { name: "Reminders for everyone: Events" }));
    fireEvent.click(drawer.getByRole("button", { name: "Turn all off" }));
    expect(drawer.getByText("No reminders: they are off.")).toBeTruthy();
    fireEvent.click(drawer.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(put).toHaveBeenCalledWith(expect.stringMatching(/\/reminders\/defaults\/EVENT$/), { offsets: [] }));
  });

  it("hides everyone's reminders from others, in Bangla too", async () => {
    get.mockReturnValue(ok(settings({ can_manage: false })));
    renderApp(<RemindersCard />, { locale: "bn" });
    expect(await screen.findByRole("heading", { name: "আমার রিমাইন্ডার" })).toBeTruthy();
    expect((await screen.findAllByText("৩০ মিনিট আগে, অ্যাপে")).length).toBe(1);
    expect(screen.queryByRole("heading", { name: "সবার জন্য রিমাইন্ডার" })).toBeNull();
  });
});
