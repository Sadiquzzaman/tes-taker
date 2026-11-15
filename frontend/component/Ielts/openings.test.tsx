import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/i18n/test-utils";
import TestOpenings from "./TestOpenings";

const get = vi.fn();
const post = vi.fn();
const patch = vi.fn();
const del = vi.fn();
vi.mock("@/lib/axios", () => ({
  default: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a), patch: (...a: unknown[]) => patch(...a), delete: (...a: unknown[]) => del(...a) },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/ielts/tests/t1/openings" }));

const ok = <T,>(payload: T) => Promise.resolve({ data: { payload } });
const test = { id: "t1", title: "Mock 3", status: "PUBLISHED", modules: ["LISTENING", "READING"], parts: [], can_edit: true } as unknown as IeltsTest;
const opening: IeltsAssignment = {
  id: "as1",
  test_id: "t1",
  section: { id: "s1", name: "Band 7 Course A" },
  opens_at: "2026-11-20T03:00:00Z",
  closes_at: "2026-11-20T11:00:00Z",
  students: 12,
  submitted: { LISTENING: 10, READING: 4 },
};

beforeEach(() => {
  post.mockReset().mockReturnValue(ok(opening));
  patch.mockReset().mockReturnValue(ok(opening));
  del.mockReset().mockReturnValue(ok(null));
  get.mockImplementation((url: string) => {
    if (url.endsWith("/ielts/tests/t1")) return ok(test);
    if (url.endsWith("/ielts/tests/t1/assignments")) return ok([opening]);
    if (url.endsWith("/ielts/assignments/as1/results")) {
      return ok([
        { student: { id: "u1", full_name: "Mitu" }, modules: { LISTENING: { status: "MARKED", raw_score: 30, band: 7, submitted_at: null } } },
        { student: { id: "u2", full_name: "Rafi" }, modules: { LISTENING: { status: "IN_PROGRESS", raw_score: null, band: null, submitted_at: null } } },
      ]);
    }
    if (url.endsWith("/sections")) return ok([{ id: "s2", name: "B", class_id: "c1" }]);
    if (url.endsWith("/classes")) return ok([{ id: "c1", class_name: "Band 6 Course" }]);
    return ok([]);
  });
});
afterEach(() => cleanup());

describe("IELTS openings (P10-04, IEL-08)", () => {
  it("lists openings with hand-ins and shows each student's band", async () => {
    renderApp(<TestOpenings testId="t1" />);
    const table = within(await screen.findByRole("table", { name: "Openings of this test" }));
    expect(table.getByText("Listening 10/12 · Reading 4/12")).toBeTruthy();
    fireEvent.click(table.getAllByRole("button", { name: "Results of Band 7 Course A" })[0]);
    const drawer = within(await screen.findByRole("dialog", { name: "Results of Band 7 Course A" }));
    expect((await drawer.findAllByText("7.0 (30/40)")).length).toBeGreaterThan(0);
    expect(drawer.getAllByText("Taking it now").length).toBeGreaterThan(0);
  });

  it("opens the test for a batch in the centre's time", async () => {
    renderApp(<TestOpenings testId="t1" />);
    // The button is enabled once the test (published) has loaded.
    const open = (await screen.findByRole("button", { name: "Open for a batch" })) as HTMLButtonElement;
    await waitFor(() => expect(open.disabled).toBe(false));
    fireEvent.click(open);
    const drawer = within(await screen.findByRole("dialog", { name: "Open for a batch" }));
    fireEvent.change(await drawer.findByLabelText("Batch"), { target: { value: "s2" } });
    fireEvent.change(drawer.getByLabelText("Opens on"), { target: { value: "2026-11-20" } });
    fireEvent.change(drawer.getByLabelText("Closes on"), { target: { value: "2026-11-20" } });
    fireEvent.click(drawer.getByRole("button", { name: "Save" }));
    // 09:00 to 17:00 in Dhaka (UTC+6).
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(expect.stringMatching(/\/ielts\/tests\/t1\/assignments$/), { section_id: "s2", opens_at: "2026-11-20T03:00:00.000Z", closes_at: "2026-11-20T11:00:00.000Z" }),
    );
  });

  it("removes an opening after asking", async () => {
    renderApp(<TestOpenings testId="t1" />);
    fireEvent.click((await screen.findAllByRole("button", { name: "Remove the opening for Band 7 Course A" }))[0]);
    const confirm = within(await screen.findByRole("dialog", { name: "Remove this opening?" }));
    fireEvent.click(confirm.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(del).toHaveBeenCalledWith(expect.stringMatching(/\/ielts\/assignments\/as1$/)));
  });
});
