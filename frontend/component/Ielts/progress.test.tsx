import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/i18n/test-utils";
import BandReport from "./BandReport";
import IeltsOverview from "./IeltsOverview";
import IeltsProgress from "./IeltsProgress";

const get = vi.fn();
let memberRole = "TEACHER";
vi.mock("@/lib/axios", () => ({ default: { get: (...a: unknown[]) => get(...a) } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/ielts/overview" }));
vi.mock("@/hooks/organization/useWorkspace", () => ({ default: () => ({ memberRole }) }));

const ok = <T,>(payload: T) => Promise.resolve({ data: { payload } });
const profile: IeltsProfile = { student: { id: "u1", full_name: "Mitu", batch: "Band 7 Course A" }, test_type: "ACADEMIC", target_overall: 7, target_bands: { WRITING: 6.5 }, test_date: "2026-12-20", days_to_test: 34, updated_at: null };
const point = (band: number, title: string): IeltsBandPoint => ({ attempt_id: title, assignment_id: "as1", test_title: title, purpose: "MOCK", band, raw_score: null, at: "2026-11-10T00:00:00Z" });

beforeEach(() => {
  memberRole = "TEACHER";
  get.mockImplementation((url: string) => {
    if (url.endsWith("/ielts/dashboard")) {
      return ok({ batches: 3, students: 41, upcoming: [{ assignment_id: "as1", test_title: "Mock 4", batch: "Band 7 Course A", opens_at: "2026-11-18T03:00:00Z", closes_at: "2026-11-18T11:00:00Z" }], waiting: { writing: 5, speaking: 2 }, batch_bands: [{ section_id: "s1", batch: "Band 7 Course A", bands: { LISTENING: 6.8, WRITING: 6 } }] });
    }
    if (url.endsWith("/ielts/dashboard/me")) return ok({ profile, latest: { LISTENING: 7.5, WRITING: 6 }, next: null, open_now: 0 });
    if (url.includes("/ielts/progress/")) {
      return ok({
        profile,
        modules: { LISTENING: [point(6.5, "Mock 1"), point(7.5, "Mock 2")], READING: [], WRITING: [point(6, "Mock 2")], SPEAKING: [] },
        mocks: [{ assignment_id: "as1", test_title: "Mock 2", bands: { LISTENING: 7.5, READING: 7, WRITING: 6, SPEAKING: 6.5 }, overall: 7, at: "2026-11-10T00:00:00Z" }],
        question_types: [{ type: "MATCH_HEADINGS", right: 9, total: 20, percent: 45 }, { type: "TFNG", right: 18, total: 20, percent: 90 }],
      });
    }
    if (url.includes("/ielts/report/")) {
      return ok({
        student: profile.student,
        test: { id: "t1", title: "Mock 2", test_type: "ACADEMIC", purpose: "MOCK" },
        window: { opens_at: "2026-11-10T03:00:00Z", closes_at: "2026-11-10T11:00:00Z" },
        modules: {
          LISTENING: { band: 7.5, raw_score: 32, status: "MARKED", criteria: null, feedback: null },
          READING: { band: 7, raw_score: 30, status: "MARKED", criteria: null, feedback: null },
          WRITING: { band: 6, raw_score: null, status: "MARKED", criteria: { tasks: [{ part_no: 2, band: 6, criteria: { CC: 6, LR: 6, TR: 6, GRA: 6 }, comment: "Plan first." }] }, feedback: "Good work." },
          SPEAKING: { band: 6.5, raw_score: null, status: "MARKED", criteria: { speaking: { P: 7, FC: 6.5, LR: 6.5, GRA: 6 } }, feedback: null },
        },
        overall: 7,
        targets: { overall: 7, bands: { WRITING: 6.5 } },
        test_date: "2026-12-20",
      });
    }
    return ok([]);
  });
});
afterEach(() => cleanup());

describe("IELTS overview, progress and band report (P10-07)", () => {
  it("shows staff the centre at a glance", async () => {
    renderApp(<IeltsOverview />);
    expect(await screen.findByText("41")).toBeTruthy();
    expect(screen.getByText("Mock 4 · Band 7 Course A")).toBeTruthy();
    const table = within(screen.getByRole("table", { name: "Average band per module" }));
    expect(table.getAllByText("6.8").length).toBeGreaterThan(0);
  });

  it("shows a student targets against latest bands and the countdown", async () => {
    memberRole = "STUDENT";
    renderApp(<IeltsOverview />);
    expect(await screen.findByText("34")).toBeTruthy();
    const table = within(screen.getByRole("table", { name: "Targets and latest bands" }));
    expect(table.getAllByText("Reached").length).toBeGreaterThan(0); // Listening 7.5 ≥ 7
    expect(table.getAllByText("0.5 to go").length).toBeGreaterThan(0); // Writing 6 vs 6.5
  });

  it("charts bands per module and lists the weakest question types first", async () => {
    renderApp(<IeltsProgress studentId="u1" />);
    expect(await screen.findByText("IELTS progress of Mitu")).toBeTruthy();
    expect(screen.getByRole("figure", { name: "Listening bands in order: 6.5, 7.5" })).toBeTruthy();
    const types = within(screen.getByRole("table", { name: "Question types" }));
    const rows = types.getAllByRole("row").slice(1).map((r) => r.textContent);
    expect(rows[0]).toContain("Matching headings");
    expect(rows[0]).toContain("45%");
    expect(within(screen.getByRole("table", { name: "Mock tests" })).getAllByText("7.0").length).toBeGreaterThan(0);
  });

  it("prints a one-page band report", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    renderApp(<BandReport assignmentId="as1" studentId="u1" />);
    const report = within(await screen.findByRole("article", { name: "IELTS band report" }));
    expect(report.getByText("Overall band")).toBeTruthy();
    expect(report.getByText("Plan first.")).toBeTruthy();
    expect(report.getByText("Good work.")).toBeTruthy();
    expect(report.getByText(/Pronunciation 7.0/)).toBeTruthy();
    // Criteria in the official order, whatever order they were stored in.
    expect(report.getByText(/^Task Response 6.0 · Coherence and Cohesion/)).toBeTruthy();
    expect(report.getByText(/^Fluency and Coherence 6.5 ·.*Pronunciation 7.0$/)).toBeTruthy();
    fireEvent.click(report.getByRole("button", { name: "Print" }));
    expect(print).toHaveBeenCalled();
  });
});
