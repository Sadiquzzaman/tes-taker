import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/i18n/test-utils";
import IeltsStudents from "./IeltsStudents";
import MyIeltsProfile from "./MyIeltsProfile";

const get = vi.fn();
const put = vi.fn();
vi.mock("@/lib/axios", () => ({ default: { get: (...a: unknown[]) => get(...a), put: (...a: unknown[]) => put(...a) } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/ielts/students" }));

const ok = <T,>(payload: T) => Promise.resolve({ data: { payload } });
const profile = (extra: Partial<IeltsProfile> = {}): IeltsProfile => ({
  student: { id: "st1", full_name: "Mitu", batch: "Band 7 Course A" },
  test_type: "ACADEMIC",
  target_overall: 7,
  target_bands: { LISTENING: 7.5, WRITING: 6.5 },
  test_date: "2026-12-15",
  days_to_test: 30,
  updated_at: null,
  ...extra,
});

beforeEach(() => {
  put.mockReset().mockReturnValue(ok(profile()));
  get.mockImplementation((url: string) =>
    url.endsWith("/ielts/profiles") ? ok([profile(), profile({ student: { id: "st2", full_name: "Rafi", batch: "Band 7 Course A" }, test_type: null, target_overall: null, target_bands: {}, test_date: null, days_to_test: null })]) : url.endsWith("/ielts/profiles/me") ? ok(profile()) : ok([]),
  );
});
afterEach(() => cleanup());

describe("IELTS profiles (IEL-02)", () => {
  it("lists students with their targets and saves a profile", async () => {
    renderApp(<IeltsStudents />);
    const table = within(await screen.findByRole("table", { name: "Students and their IELTS targets" }));
    expect(table.getAllByText("7.0").length).toBeGreaterThan(0);
    expect(table.getByText(/30 days left/)).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Edit Rafi's profile" })[0]);
    const drawer = within(await screen.findByRole("dialog", { name: "Rafi" }));
    fireEvent.click(drawer.getByLabelText("General Training"));
    fireEvent.change(drawer.getByLabelText("Target overall band"), { target: { value: "6.5" } });
    fireEvent.change(drawer.getByLabelText("Writing"), { target: { value: "6" } });
    fireEvent.click(drawer.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith(expect.stringMatching(/\/ielts\/profiles\/st2$/), {
        test_type: "GENERAL",
        target_overall: 6.5,
        target_bands: { LISTENING: null, READING: null, WRITING: 6, SPEAKING: null },
        test_date: null,
      }),
    );
  });

  it("shows a student their targets and the days to their test", async () => {
    renderApp(<MyIeltsProfile />);
    expect(await screen.findByText("30 days left")).toBeTruthy();
    const targets = within(screen.getByRole("list", { name: "Target band per module" }));
    expect(targets.getByText("7.5")).toBeTruthy();
  });

  it("says when the workspace is not an IELTS centre", async () => {
    get.mockImplementation(() => Promise.reject({ response: { status: 403 } }));
    renderApp(<MyIeltsProfile />);
    expect(await screen.findByText("IELTS pages are for IELTS centres.")).toBeTruthy();
  });
});
