import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/i18n/test-utils";
import sidebarList from "@/utils/sidebarList";
import ReportCardSheet from "./ReportCardSheet";
import ReportCardsPage from "./ReportCardsPage";
import ReportCardsPrint from "./ReportCardsPrint";

const get = vi.fn();
const post = vi.fn();
let memberRole: string | undefined = "OWNER";
vi.mock("@/lib/authSession", () => ({ getStoredUser: () => ({ id: "me", role: memberRole === "STUDENT" ? "STUDENT" : "TEACHER", access_token: "token" }), clearAuthSession: vi.fn() }));
vi.mock("@/hooks/organization/useWorkspace", () => ({ default: () => ({ memberRole }) }));
vi.mock("@/lib/axios", () => ({
  default: {
    get: (...args: unknown[]) => get(...args),
    post: (...args: unknown[]) => post(...args),
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/report-cards" }));

const ok = <T,>(payload: T) => Promise.resolve({ data: { payload } });
const summary = (extra: Partial<ReportCardSummary> = {}): ReportCardSummary => ({
  id: "card1",
  version: 1,
  locale: "bn",
  term: { id: "t1", name: "Half-yearly" },
  teacher_remark: "Works hard",
  principal_remark: null,
  generated_at: "2026-11-13T05:00:00Z",
  shared_at: null,
  share_expires_at: null,
  ...extra,
});
const list = (latest: ReportCardSummary | null, canPrincipal = true): ReportCardList => ({
  section: { id: "sa", name: "A", class_name: "Class 6", session: { id: "s1", name: "2026", closed: false } },
  term: { id: "t1", name: "Half-yearly" },
  can_write_principal_remark: canPrincipal,
  rows: [
    { student: { id: "st1", full_name: "Mitu Das", roll_no: "1" }, latest },
    { student: { id: "st2", full_name: "Rafi Ahmed", roll_no: "2" }, latest: null },
  ],
});
const line = (score: number): ScoreLine => ({ exams_pct: score, homework_pct: 100, attendance_pct: 95, behaviour_pct: 90, score_pct: score, grade: { grade: "A+", gpa: 5 }, counts: { exams: 3, homework: 1, ratings: 2 } });
const card = (extra: Partial<ReportCardView> = {}): ReportCardView => ({
  ...summary({ principal_remark: "Well done" }),
  snapshot: {
    organization: { name: "Sunrise School" },
    show_position: true,
    page: {
      student: { id: "st1", full_name: "Mitu Das", roll_no: "1" },
      section: { id: "sa", name: "A", class_name: "Class 6", session: { id: "s1", name: "2026", closed: false } },
      terms: [{ id: "t1", name: "Half-yearly" }],
      period: { from: "2026-01-01", to: "2026-06-30", term: { id: "t1", name: "Half-yearly" } },
      weights: { exams_pct: 50, homework_pct: 20, attendance_pct: 20, behaviour_pct: 10, is_default: true },
      overall: line(88),
      subjects: [{ subject: { id: "math", name: "Math" }, ...line(90.5) }],
      position: 1,
      class_size: 40,
      attendance: { counts: { present: 18, late: 1, absent: 1, leave: 0 }, attendance_pct: 95 },
      homework: { set: 1, missing: 0, late: 0, on_time_pct: 100 },
      trend: [],
      strengths: [{ subject: { id: "math", name: "Math" }, ...line(90.5) }],
      weaknesses: [],
    },
  },
  ...extra,
});

beforeEach(() => {
  memberRole = "OWNER";
  get.mockReset();
  post.mockReset();
});
afterEach(() => cleanup());

describe("report cards page (PRF-09)", () => {
  it("makes the section's cards with each student's remarks, in the chosen language", async () => {
    get.mockImplementation((url: string) =>
      url.endsWith("/scores/sections")
        ? ok({ session: { id: "s1", name: "2026", closed: false }, terms: [{ id: "t1", name: "Half-yearly" }], sections: [{ id: "sa", name: "A", class_name: "Class 6" }] })
        : url.endsWith("/report-cards")
          ? ok(list(summary()))
          : Promise.reject(new Error(url)),
    );
    post.mockReturnValue(ok(list(summary({ version: 2, principal_remark: "Well done" }))));
    renderApp(<ReportCardsPage />);
    expect(await screen.findByText("1 of 2 cards made")).toBeTruthy();
    const remark = (await screen.findByLabelText("Teacher's remark for Mitu Das")) as HTMLTextAreaElement;
    await waitFor(() => expect(remark.value).toBe("Works hard"));
    expect(screen.getByRole("link", { name: "Open the card of Mitu Das" }).getAttribute("href")).toBe("/report-cards/card1?locale=bn");
    fireEvent.change(screen.getByLabelText("Principal's remark for Mitu Das"), { target: { value: "Well done" } });
    fireEvent.change(screen.getByLabelText("Card language"), { target: { value: "en" } });
    expect(screen.getByRole("link", { name: "Print all (one PDF)" }).getAttribute("href")).toBe("/report-cards/print?section_id=sa&locale=en");
    fireEvent.click(screen.getByRole("button", { name: "Make cards" }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post.mock.calls[0][1]).toEqual({
      section_id: "sa",
      term_id: undefined,
      locale: "en",
      rows: [
        { student_id: "st1", teacher_remark: "Works hard", principal_remark: "Well done" },
        { student_id: "st2", teacher_remark: "", principal_remark: "" },
      ],
    });
    expect(await screen.findByText("1 card made")).toBeTruthy();
  });

  it("sends the cards to guardians after asking, and shows how long the link works", async () => {
    get.mockImplementation((url: string) =>
      url.endsWith("/scores/sections")
        ? ok({ session: { id: "s1", name: "2026", closed: false }, terms: [], sections: [{ id: "sa", name: "A", class_name: "Class 6" }] })
        : ok(list(summary({ shared_at: "2026-11-13T05:00:00Z", share_expires_at: "2999-12-13T05:00:00Z" }))),
    );
    post.mockReturnValue(ok({ cards: 1, guardian_sms: 2, links: [] }));
    renderApp(<ReportCardsPage />);
    expect(await screen.findByText(/^Link works until/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Send to guardians" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Send these report cards to guardians?" }));
    expect(dialog.getByText(/SMS uses your SMS credits/)).toBeTruthy();
    fireEvent.click(dialog.getByRole("button", { name: "Send to guardians" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith(expect.stringMatching(/\/report-cards\/share$/), { section_id: "sa", term_id: undefined }));
    expect(await screen.findByText("1 card sent")).toBeTruthy();
    expect(screen.getByText("2 SMS on their way to guardians.")).toBeTruthy();
  });

  it("leaves the principal's remark to owners and admins", async () => {
    memberRole = "TEACHER";
    get.mockImplementation((url: string) =>
      url.endsWith("/scores/sections")
        ? ok({ session: { id: "s1", name: "2026", closed: false }, terms: [], sections: [{ id: "sa", name: "A", class_name: "Class 6" }] })
        : ok(list(summary({ principal_remark: "Well done" }), false)),
    );
    renderApp(<ReportCardsPage />);
    expect(await screen.findByText("Principal: Well done")).toBeTruthy();
    expect(screen.queryByLabelText("Principal's remark for Mitu Das")).toBeNull();
  });

  it("shows students their own cards", async () => {
    memberRole = "STUDENT";
    get.mockImplementation(() => ok([summary()]));
    renderApp(<ReportCardsPage />);
    expect((await screen.findByRole("link", { name: "Open" })).getAttribute("href")).toBe("/report-cards/card1?locale=bn");
    expect(get).toHaveBeenCalledWith(expect.stringMatching(/\/report-cards\/mine$/), expect.anything());
  });
});

describe("printed report card", () => {
  it("prints the school, subjects with grade and GPA, position, attendance and remarks, in Bangla", async () => {
    renderApp(<ReportCardSheet card={card()} />, { locale: "bn" });
    const sheet = within(screen.getByRole("article", { name: "Mitu Das-এর রিপোর্ট কার্ড" }));
    expect(sheet.getByText("Sunrise School")).toBeTruthy();
    expect(sheet.getByText("৪০ জনের মধ্যে ১")).toBeTruthy();
    expect(sheet.getByRole("row", { name: /Math/ }).textContent).toContain("৫.০০");
    expect(sheet.getByText("Well done")).toBeTruthy();
    cleanup();
    renderApp(<ReportCardSheet card={card({ snapshot: { ...card().snapshot, show_position: false } })} />);
    expect(within(screen.getByRole("article", { name: "Report card of Mitu Das" })).queryByText("1 of 40")).toBeNull();
  });

  it("prints a whole section's cards, one per page", async () => {
    get.mockImplementation(() => ok([card(), card({ id: "card2", snapshot: { ...card().snapshot, page: { ...card().snapshot.page, student: { id: "st2", full_name: "Rafi Ahmed", roll_no: "2" } } } })]));
    renderApp(<ReportCardsPrint sectionId="sa" termId="t1" />);
    expect(await screen.findAllByRole("article")).toHaveLength(2);
    expect(get).toHaveBeenCalledWith(expect.stringMatching(/\/report-cards\/print$/), { params: { section_id: "sa", term_id: "t1" } });
    expect(screen.getByText("2 cards")).toBeTruthy();
  });
});

describe("menu", () => {
  it("puts Report cards in Results for staff, solo teachers and students", () => {
    const items = sidebarList.filter((entry) => entry.route === "/report-cards");
    expect(items).toHaveLength(3);
    expect(items.every((entry) => entry.feature === "performance" && entry.group === "results")).toBe(true);
  });
});
