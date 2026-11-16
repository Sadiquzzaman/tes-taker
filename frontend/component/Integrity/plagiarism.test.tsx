import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/i18n/test-utils";
import MatchReview from "./MatchReview";
import PlagiarismSettings from "./PlagiarismSettings";
import SimilarityReport from "./SimilarityReport";

const get = vi.fn();
const post = vi.fn();
const put = vi.fn();
vi.mock("@/lib/axios", () => ({ default: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a), put: (...a: unknown[]) => put(...a) } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/homework/h1/similarity" }));

const ok = <T,>(payload: T) => Promise.resolve({ data: { payload } });
const person = (id: string, full_name: string) => ({ id, full_name });
const report: SimilarityReportData = {
  check: { id: "c1", ran_at: "2026-11-15T10:00:00Z", ran_by: null, submissions: 3 },
  thresholds: { high: 40, medium: 20, min_words: 50 },
  submissions: [
    { submission_id: "s1", student: person("u1", "Ana"), part_no: null, words: 120, not_checked: null, percent: 82, level: "HIGH", most_similar: [{ match_id: "m1", student: person("u2", "Bina"), percent: 82 }] },
    { submission_id: "s3", student: person("u3", "Chan"), part_no: null, words: 10, not_checked: "TOO_SHORT", percent: 0, level: null, most_similar: [] },
  ],
  matches: [
    { id: "m1", part_no: null, a: { student: person("u1", "Ana"), percent: 82 }, b: { student: person("u2", "Bina"), percent: 70 }, score: 82, level: "HIGH", review_decision: null, review_note: null },
    { id: "m2", part_no: null, a: { student: person("u1", "Ana"), percent: 5 }, b: { student: person("u4", "Dipu"), percent: 4 }, score: 5, level: "LOW", review_decision: null, review_note: null },
  ],
};
const text = "In my view the industrial revolution changed the way people lived.";
const match: SimilarityMatchView = {
  id: "m1",
  part_no: null,
  level: "HIGH",
  score: 82,
  a: { student: person("u1", "Ana"), text, spans: [{ start: 11, end: 65 }], percent: 82 },
  b: { student: person("u2", "Bina"), text: "The industrial revolution changed the way people lived.", spans: [{ start: 0, end: 54 }], percent: 100 },
  review_decision: null,
  review_note: null,
  reviewed_by: null,
  reviewed_at: null,
};

beforeEach(() => {
  get.mockImplementation((url: string) => (url.includes("/integrity/matches/") ? ok(match) : url.endsWith("/integrity/settings") ? ok(report.thresholds) : ok(report)));
  post.mockReset().mockReturnValue(ok(report));
  put.mockReset().mockImplementation((url: string, body: unknown) => (url.endsWith("/review") ? ok({ ...match, review_decision: "COPIED", reviewed_at: "2026-11-16T10:00:00Z" }) : ok(body)));
});
afterEach(() => cleanup());

describe("Plagiarism checks (PLG-01–03)", () => {
  it("lists similarity per submission with reasons for unchecked texts, and runs on demand", async () => {
    renderApp(<SimilarityReport scopeType="HOMEWORK" scopeId="h1" title="Essay" back={{ href: "/homework/h1", label: "Back" }} />);
    const table = within(await screen.findByRole("table", { name: "Submissions and their similarity" }));
    expect(table.getAllByText("High · 82%").length).toBeGreaterThan(0);
    expect(table.getAllByText("Not checked: too short").length).toBeGreaterThan(0);
    expect(table.getAllByRole("link", { name: "Compare Ana with Bina" })[0].getAttribute("href")).toBe("/integrity/matches/m1");
    // Low pairs that nobody reviewed stay out of the pairs list.
    const pairs = within(screen.getByRole("table", { name: "Similar pairs" }));
    expect(pairs.queryAllByText(/Dipu/)).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Run check now" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith(expect.stringMatching(/\/integrity\/checks$/), { scope_type: "HOMEWORK", scope_id: "h1" }));
  });

  it("links IELTS matches back to the IELTS menu", async () => {
    renderApp(<SimilarityReport scopeType="IELTS_WRITING" scopeId="a1" back={{ href: "/ielts/tests", label: "Back" }} />);
    const table = within(await screen.findByRole("table", { name: "Submissions and their similarity" }));
    expect(table.getAllByRole("link", { name: "Compare Ana with Bina" })[0].getAttribute("href")).toBe("/integrity/matches/m1?from=ielts");
  });

  it("shows both texts with the shared passages marked and saves the review", async () => {
    renderApp(<MatchReview matchId="m1" />);
    const ana = within(await screen.findByRole("region", { name: "Text of Ana" }));
    expect(ana.getByText("the industrial revolution changed the way people lived").tagName).toBe("MARK");
    fireEvent.click(screen.getByLabelText("Copied"));
    fireEvent.change(screen.getByLabelText("Note"), { target: { value: "Same essay." } });
    fireEvent.click(screen.getByRole("button", { name: "Save review" }));
    await waitFor(() => expect(put).toHaveBeenCalledWith(expect.stringMatching(/\/integrity\/matches\/m1\/review$/), { decision: "COPIED", note: "Same essay." }));
  });

  it("saves the thresholds", async () => {
    renderApp(<PlagiarismSettings />);
    fireEvent.change(await screen.findByLabelText("High from (%)"), { target: { value: "50" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(put).toHaveBeenCalledWith(expect.stringMatching(/\/integrity\/settings$/), { high: 50, medium: 20, min_words: 50 }));
  });
});
