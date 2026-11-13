import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/i18n/test-utils";
import sidebarList from "@/utils/sidebarList";
import PerformanceSettingsPage from "./PerformanceSettingsPage";

const get = vi.fn();
const put = vi.fn();
let canManageBilling = true;
vi.mock("@/lib/authSession", () => ({ getStoredUser: () => ({ id: "me", role: "TEACHER", access_token: "token" }), clearAuthSession: vi.fn() }));
vi.mock("@/hooks/organization/useBillingAccess", () => ({ default: () => ({ canManageBilling }) }));
vi.mock("@/lib/axios", () => ({
  default: {
    get: (...args: unknown[]) => get(...args),
    put: (...args: unknown[]) => put(...args),
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/performance-settings" }));

const ok = <T,>(payload: T) => Promise.resolve({ data: { payload } });
const DEFAULT = { exams_pct: 50, homework_pct: 20, attendance_pct: 20, behaviour_pct: 10 };
const weights = (extra: Partial<SessionScoreWeights> = {}): SessionScoreWeights => ({
  session: { id: "s1", name: "2026", closed: false },
  default_weights: DEFAULT,
  classes: [
    { class: { id: "c6", name: "Class 6" }, weights: DEFAULT, is_default: true },
    { class: { id: "c7", name: "Class 7" }, weights: { exams_pct: 60, homework_pct: 20, attendance_pct: 10, behaviour_pct: 10 }, is_default: false },
  ],
  ...extra,
});
const settings: PerformanceSettings = { at_risk: { score_pct: 40, attendance_pct: 75, missing_homework: 3 }, show_rank: false };

const answer = (w: SessionScoreWeights) =>
  get.mockImplementation((url: string) =>
    url.endsWith("/sessions")
      ? ok([{ id: "s1", name: "2026", start_date: "2026-01-01", end_date: "2026-12-31", status: "ACTIVE", is_default: true }])
      : url.endsWith("/scores/weights")
        ? ok(w)
        : url.endsWith("/scores/settings")
          ? ok(settings)
          : Promise.reject(new Error(url)),
  );

beforeEach(() => {
  canManageBilling = true;
  get.mockReset();
  put.mockReset();
});
afterEach(() => cleanup());

describe("performance settings (PRF-01, PRF-07, PRF-10)", () => {
  it("sets a class's weights only when they add up to 100", async () => {
    answer(weights());
    put.mockReturnValue(ok(weights({ classes: [{ class: { id: "c6", name: "Class 6" }, weights: { exams_pct: 70, homework_pct: 10, attendance_pct: 10, behaviour_pct: 10 }, is_default: false }] })));
    renderApp(<PerformanceSettingsPage />);
    const table = within(await screen.findByRole("table", { name: "Score weights for 2026" }));
    expect(await table.findByText("Default")).toBeTruthy();
    const save = table.getByRole("button", { name: "Save weights for Class 6" });
    expect(save.hasAttribute("disabled")).toBe(true);
    fireEvent.change(table.getByLabelText("Exams % for Class 6"), { target: { value: "70" } });
    expect(table.getByText("120%")).toBeTruthy();
    expect(screen.getByText("Each class's weights must add up to 100%.")).toBeTruthy();
    expect(save.hasAttribute("disabled")).toBe(true);
    fireEvent.change(table.getByLabelText("Homework % for Class 6"), { target: { value: "10" } });
    fireEvent.change(table.getByLabelText("Attendance % for Class 6"), { target: { value: "10" } });
    expect(table.getAllByText("100%")).toHaveLength(2);
    fireEvent.click(save);
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(put.mock.calls[0][0]).toMatch(/\/scores\/weights$/);
    expect(put.mock.calls[0][1]).toEqual({ session_id: "s1", class_id: "c6", exams_pct: 70, homework_pct: 10, attendance_pct: 10, behaviour_pct: 10 });
    expect(await screen.findByText("Weights saved; scores now use them")).toBeTruthy();
  });

  it("changes the at-risk limits and the position setting, refusing a bad limit", async () => {
    answer(weights());
    put.mockReturnValue(ok({ at_risk: { score_pct: 45, attendance_pct: 75, missing_homework: 3 }, show_rank: true }));
    renderApp(<PerformanceSettingsPage />);
    const missing = await screen.findByLabelText("Missing homework (or more)");
    fireEvent.change(missing, { target: { value: "0" } });
    expect(screen.getByText("Use whole numbers: percentages 0–100, missing homework 1–50.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save settings" }).hasAttribute("disabled")).toBe(true);
    fireEvent.change(missing, { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Score below (%)"), { target: { value: "45" } });
    fireEvent.click(screen.getByLabelText(/Show students their position/));
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));
    await waitFor(() => expect(put).toHaveBeenCalledWith(expect.stringMatching(/\/scores\/settings$/), { at_risk: { score_pct: 45, attendance_pct: 75, missing_homework: 3 }, show_rank: true }));
    expect(await screen.findByText("Settings saved")).toBeTruthy();
    // Behaviour criteria are edited on the Behaviour page, not repeated here.
    expect(screen.getByRole("link", { name: "Open Behaviour" }).getAttribute("href")).toBe("/behaviour");
  });

  it("is read-only for other staff and in a closed session, and in Bangla", async () => {
    canManageBilling = false;
    answer(weights());
    renderApp(<PerformanceSettingsPage />);
    expect(await screen.findByText("You can see these settings; owners and admins change them.")).toBeTruthy();
    expect(((await screen.findByLabelText("Exams % for Class 7")) as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: /Save weights/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Save settings" })).toBeNull();

    cleanup();
    canManageBilling = true;
    answer(weights({ session: { id: "s1", name: "2025", closed: true } }));
    renderApp(<PerformanceSettingsPage />, { locale: "bn" });
    expect(await screen.findByText("এই সেশন বন্ধ, তাই এর ভার বদলানো যাবে না।")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /ভার সংরক্ষণ/ })).toBeNull();
  });

  it("is in Results under setup for owners, admins and solo teachers, behind the performance feature", () => {
    const items = sidebarList.filter((entry) => entry.route === "/performance-settings");
    expect(items).toHaveLength(2);
    expect(items.every((entry) => entry.feature === "performance" && entry.group === "results" && entry.setup)).toBe(true);
    expect(items.find((entry) => entry.category === "Organization")?.memberRoles).toEqual(["OWNER", "ADMIN"]);
  });
});
