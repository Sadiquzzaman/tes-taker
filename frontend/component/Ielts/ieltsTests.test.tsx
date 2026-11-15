import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/i18n/test-utils";
import BandTables from "./BandTables";
import IeltsTests from "./IeltsTests";

const get = vi.fn();
const post = vi.fn();
const put = vi.fn();
const del = vi.fn();
const push = vi.fn();
let memberRole = "TEACHER";
vi.mock("@/lib/axios", () => ({
  default: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a), put: (...a: unknown[]) => put(...a), delete: (...a: unknown[]) => del(...a) },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => "/ielts/tests" }));
vi.mock("@/hooks/organization/useWorkspace", () => ({ default: () => ({ memberRole }) }));

const ok = <T,>(payload: T) => Promise.resolve({ data: { payload } });
const summary = (extra: Partial<IeltsTestSummary> = {}): IeltsTestSummary => ({
  id: "t1",
  title: "Mock 1",
  test_type: "ACADEMIC",
  purpose: "MOCK",
  modules: ["LISTENING", "READING", "WRITING", "SPEAKING"],
  durations: {},
  status: "DRAFT",
  needs_review: false,
  created_by: { id: "u1", full_name: "Tania" },
  updated_at: "2026-11-15T10:00:00Z",
  question_counts: { LISTENING: 40, READING: 12 },
  ...extra,
});
const table = (extra: Partial<IeltsBandTable>): IeltsBandTable => ({
  module: "LISTENING",
  test_type: null,
  rows: [
    { min_raw: 39, band: 9 },
    { min_raw: 30, band: 7 },
    { min_raw: 0, band: 0 },
  ],
  customised: false,
  updated_at: null,
  ...extra,
});

beforeEach(() => {
  memberRole = "TEACHER";
  push.mockReset();
  post.mockReset().mockReturnValue(ok({ id: "new1" }));
  put.mockReset().mockReturnValue(ok(table({})));
  del.mockReset().mockReturnValue(ok(null));
  get.mockImplementation((url: string) =>
    url.endsWith("/ielts/tests")
      ? ok([summary(), summary({ id: "t2", title: "Task 2 practice", purpose: "PRACTICE", modules: ["WRITING"], status: "PUBLISHED", question_counts: {}, needs_review: true })])
      : url.endsWith("/ielts/band-tables")
        ? ok([table({}), table({ module: "READING", test_type: "ACADEMIC", customised: true }), table({ module: "READING", test_type: "GENERAL" })])
        : ok([]),
  );
});
afterEach(() => cleanup());

describe("IELTS tests list (IEL-03)", () => {
  it("lists mocks and practice sets with questions per module and status", async () => {
    renderApp(<IeltsTests />);
    const rows = within(await screen.findByRole("table", { name: "IELTS tests" }));
    expect(rows.getByText("Listening 40/40 · Reading 12/40")).toBeTruthy();
    expect(rows.getByText("Practice set")).toBeTruthy();
    expect(rows.getByText("Published")).toBeTruthy();
    expect(rows.getByText("Converted — check before use")).toBeTruthy();
  });

  it("creates a practice set from chosen parts and opens it", async () => {
    renderApp(<IeltsTests />);
    fireEvent.click((await screen.findAllByRole("button", { name: "New test" }))[0]);
    const dialog = within(await screen.findByRole("dialog", { name: "New test" }));
    fireEvent.change(dialog.getByLabelText(/Title/), { target: { value: "Passage 2 practice" } });
    fireEvent.click(dialog.getByLabelText(/Practice set/));
    fireEvent.click(dialog.getByLabelText("Passage 1"));
    fireEvent.click(dialog.getByLabelText("Passage 2"));
    fireEvent.click(dialog.getByRole("button", { name: "Create" }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(expect.stringMatching(/\/ielts\/tests$/), { title: "Passage 2 practice", test_type: "ACADEMIC", purpose: "PRACTICE", module: "READING", part_nos: [2] }),
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/ielts/tests/new1"));
  });

  it("copies a test and asks before deleting", async () => {
    renderApp(<IeltsTests />);
    fireEvent.click((await screen.findAllByRole("button", { name: "Copy Mock 1" }))[0]);
    await waitFor(() => expect(post).toHaveBeenCalledWith(expect.stringMatching(/\/ielts\/tests\/t1\/duplicate$/)));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/ielts/tests/new1"));
    fireEvent.click(screen.getAllByRole("button", { name: "Delete Mock 1" })[0]);
    const confirm = within(await screen.findByRole("dialog", { name: "Delete this test?" }));
    fireEvent.click(confirm.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(del).toHaveBeenCalledWith(expect.stringMatching(/\/ielts\/tests\/t1$/)));
  });
});

describe("IELTS band tables (IEL-04, IEL-05)", () => {
  it("shows the three tables to teachers without editing", async () => {
    renderApp(<BandTables />);
    expect(await screen.findByText("General Training Reading")).toBeTruthy();
    expect(screen.getByText("Changed by your centre")).toBeTruthy();
    expect(screen.getByText("Only owners and admins can change band tables.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
  });

  it("lets owners change a table and put it back", async () => {
    memberRole = "OWNER";
    renderApp(<BandTables />);
    await screen.findByText("Listening");
    fireEvent.change(screen.getAllByLabelText("Band 2")[0], { target: { value: "6.5" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Save" })[0]);
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith(expect.stringMatching(/\/ielts\/band-tables$/), {
        module: "LISTENING",
        rows: [
          { min_raw: 39, band: 9 },
          { min_raw: 30, band: 6.5 },
          { min_raw: 0, band: 0 },
        ],
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Back to default" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith(expect.stringMatching(/\/ielts\/band-tables\/reset$/), { module: "READING", test_type: "ACADEMIC" }));
  });
});
