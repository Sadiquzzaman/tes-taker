import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/i18n/test-utils";
import MyIeltsTests from "../MyIeltsTests";
import IeltsAttemptScreen from "./IeltsAttemptScreen";

const get = vi.fn();
const post = vi.fn();
const put = vi.fn();
const push = vi.fn();
vi.mock("@/lib/axios", () => ({ default: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a), put: (...a: unknown[]) => put(...a) } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => "/ielts/my" }));
vi.mock("@/component/RichTextEditor", () => ({ RichTextContent: ({ html }: { html: string }) => <div>{html}</div> }));

const ok = <T,>(payload: T) => Promise.resolve({ data: { payload } });
const later = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

const opening = (extra: Partial<IeltsMyAssignment> = {}): IeltsMyAssignment => ({
  id: "as1",
  test: { id: "t1", title: "Mock 3", purpose: "MOCK", test_type: "ACADEMIC", modules: ["LISTENING", "READING", "WRITING"], durations: { LISTENING: 1800, READING: 3600, WRITING: 3600 } },
  opens_at: later(-60),
  closes_at: later(60),
  is_open: true,
  attempts: {},
  ...extra,
});

const readingPart: IeltsPaperPart = {
  id: "p1",
  module: "READING",
  part_no: 1,
  title: "The history of glass",
  content: "<p>Glass was first made…</p>",
  audio_file_id: null,
  image_file_id: null,
  groups: [
    {
      id: "g1",
      type: "SHORT_ANSWER",
      instruction: "Write NO MORE THAN TWO WORDS.",
      word_limit: 2,
      shared: null,
      image_file_id: null,
      number_from: 1,
      number_to: 1,
      questions: [{ id: "q1", number_from: 1, number_to: 1, prompt: "Where was glass first made?", options: null }],
    },
    {
      id: "g2",
      type: "TFNG",
      instruction: "Do the statements agree with the passage?",
      word_limit: null,
      shared: null,
      image_file_id: null,
      number_from: 2,
      number_to: 2,
      questions: [{ id: "q2", number_from: 2, number_to: 2, prompt: "Glass is cheap.", options: null }],
    },
  ],
};

const attempt = (extra: Partial<IeltsAttemptView["attempt"]> = {}, rest: Partial<IeltsAttemptView> = {}): IeltsAttemptView => ({
  attempt: {
    id: "at1",
    assignment_id: "as1",
    module: "READING",
    status: "IN_PROGRESS",
    started_at: later(-1),
    deadline: later(59),
    submitted_at: null,
    raw_score: null,
    band: null,
    now: new Date().toISOString(),
    review_seconds: 0,
    ...extra,
  },
  test: { id: "t1", title: "Passage practice", test_type: "ACADEMIC", purpose: "PRACTICE" },
  parts: [readingPart],
  answers: {},
  ...rest,
});

beforeEach(() => {
  push.mockReset();
  put.mockReset().mockReturnValue(ok({ saved: 1 }));
  post.mockReset().mockReturnValue(ok(attempt({ id: "at9" })));
  get.mockReset().mockReturnValue(ok([opening()]));
  sessionStorage.clear();
});
afterEach(() => cleanup());

describe("My IELTS tests (P10-04)", () => {
  it("shows each module's state and starts Listening after a reminder of the time", async () => {
    renderApp(<MyIeltsTests />);
    const card = within(await screen.findByRole("region", { name: "Mock 3" }));
    expect(card.getAllByText("After the module before")).toHaveLength(2); // Reading and Writing wait for Listening
    fireEvent.click(card.getByRole("button", { name: "Start" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Start Listening?" }));
    expect(dialog.getByText(/32 minutes/)).toBeTruthy();
    fireEvent.click(dialog.getByRole("button", { name: "Start" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith(expect.stringMatching(/\/ielts\/my\/assignments\/as1\/modules\/LISTENING\/start$/)));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/ielts/attempts/at9"));
  });

  it("shows bands and lets an unfinished module continue", async () => {
    get.mockReturnValue(
      ok([
        opening({
          attempts: {
            LISTENING: { id: "a1", status: "MARKED", deadline: later(-5), raw_score: 30, band: 7 },
            READING: { id: "a2", status: "IN_PROGRESS", deadline: later(30), raw_score: null, band: null },
          },
        }),
      ]),
    );
    renderApp(<MyIeltsTests />);
    const card = within(await screen.findByRole("region", { name: "Mock 3" }));
    expect(card.getByText("Band 7.0")).toBeTruthy();
    fireEvent.click(card.getByRole("button", { name: "Continue" }));
    expect(push).toHaveBeenCalledWith("/ielts/attempts/a2");
  });
});

describe("Taking an IELTS module (P10-04)", () => {
  it("lays Reading out side by side, saves answers, marks the navigator and hands in", async () => {
    get.mockReturnValue(ok(attempt()));
    post.mockReturnValue(ok(attempt({ status: "MARKED", raw_score: 1, band: 2.5 }, { parts: null, answers: { q1: "Egypt", q2: "FALSE" } })));
    renderApp(<IeltsAttemptScreen attemptId="at1" />);
    expect(await screen.findByRole("region", { name: "Passage" })).toBeTruthy();
    expect(screen.getByRole("timer", { name: "Time left" }).textContent).toMatch(/^5[89]:\d\d$/);
    const questions = within(screen.getByRole("region", { name: "Questions" }));
    fireEvent.change(questions.getByLabelText("Question 1"), { target: { value: "Egypt" } });
    fireEvent.click(questions.getByLabelText("FALSE"));
    await waitFor(() => expect(put).toHaveBeenCalledWith(expect.stringMatching(/\/ielts\/my\/attempts\/at1\/answers$/), expect.objectContaining({ answers: expect.arrayContaining([{ question_id: "q1", answer: "Egypt" }]) })), { timeout: 4000 });
    const nav = within(screen.getByRole("navigation", { name: "Questions 1 to 40" }));
    expect(nav.getByRole("button", { name: "Question 1: answered already" })).toBeTruthy();
    fireEvent.click(questions.getByRole("button", { name: "Flag question 2 for review" }));
    expect(nav.getByRole("button", { name: "Question 2: flagged for review" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Hand in" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Hand in this module?" }));
    expect(dialog.getByText(/Every question is answered/)).toBeTruthy();
    fireEvent.click(dialog.getByRole("button", { name: "Hand in" }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(expect.stringMatching(/\/ielts\/my\/attempts\/at1\/submit$/), {
        answers: [
          { question_id: "q1", answer: "Egypt" },
          { question_id: "q2", answer: "FALSE" },
        ],
      }),
    );
    expect(await screen.findByText("Reading result")).toBeTruthy();
    expect(screen.getByText("1 / 40")).toBeTruthy();
    expect(screen.getByText("2.5")).toBeTruthy();
    expect(screen.getByText("Right answers are shown after the test closes.")).toBeTruthy();
  });

  it("hands in by itself when the time runs out", async () => {
    get.mockReturnValue(ok(attempt({ deadline: new Date(Date.now() - 1000).toISOString() })));
    renderApp(<IeltsAttemptScreen attemptId="at1" />);
    await waitFor(() => expect(post).toHaveBeenCalledWith(expect.stringMatching(/\/submit$/), { answers: [] }));
  });

  it("plays a Listening recording once", async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    const listening: IeltsPaperPart = { ...readingPart, id: "lp1", module: "LISTENING", content: null, audio_file_id: "f1" };
    get.mockReturnValue(ok(attempt({ module: "LISTENING", review_seconds: 120 }, { parts: [listening] })));
    renderApp(<IeltsAttemptScreen attemptId="at1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Play the Part 1 recording" }));
    await waitFor(() => expect(play).toHaveBeenCalledTimes(1));
    expect(screen.getByText("Playing…")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Play the Part 1 recording" })).toBeNull();
    // Coming back to the page does not play it again.
    cleanup();
    renderApp(<IeltsAttemptScreen attemptId="at1" />);
    expect(await screen.findByText("Played")).toBeTruthy();
    play.mockRestore();
  });

  it("shows right answers after hand-in when they may be shown", async () => {
    const reviewed: IeltsPaperPart = {
      ...readingPart,
      groups: [{ ...readingPart.groups[1], questions: [{ ...readingPart.groups[1].questions[0], key: { keys: ["FALSE"] }, marks: 0 }] }],
    };
    get.mockReturnValue(ok(attempt({ status: "MARKED", raw_score: 0, band: 0 }, { parts: [reviewed], answers: { q2: "TRUE" } })));
    renderApp(<IeltsAttemptScreen attemptId="at1" />);
    expect(await screen.findByText(/Not right · right answer: FALSE/)).toBeTruthy();
  });

  it("asks for a computer or tablet for mocks on a phone", async () => {
    const width = window.innerWidth;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 500 });
    get.mockReturnValue(ok(attempt({}, { test: { id: "t1", title: "Mock 3", test_type: "ACADEMIC", purpose: "MOCK" } })));
    renderApp(<IeltsAttemptScreen attemptId="at1" />);
    expect(await screen.findByText(/Mock tests are taken on a computer or a tablet/)).toBeTruthy();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  });

  it("takes Writing with a live word count and sends scripts by task", async () => {
    const task: IeltsPaperPart = { ...readingPart, id: "w1", module: "WRITING", content: "<p>The chart shows…</p>", groups: [] };
    get.mockReturnValue(ok(attempt({ module: "WRITING" }, { parts: [task] })));
    post.mockReturnValue(ok(attempt({ module: "WRITING", status: "SUBMITTED" }, { parts: [task], answers: { w1: "Sales rose by 20 percent in 2020." } })));
    renderApp(<IeltsAttemptScreen attemptId="at1" />);
    const box = await screen.findByLabelText("Your answer to Task 1");
    fireEvent.change(box, { target: { value: "Sales rose by 20 percent in 2020." } });
    expect(screen.getByText(/7 words · fewer than 150/)).toBeTruthy();
    await waitFor(() => expect(put).toHaveBeenCalledWith(expect.stringMatching(/\/answers$/), { answers: [{ part_id: "w1", answer: "Sales rose by 20 percent in 2020." }] }), { timeout: 4000 });
    fireEvent.click(screen.getByRole("button", { name: "Hand in" }));
    fireEvent.click(within(await screen.findByRole("dialog", { name: "Hand in this module?" })).getByRole("button", { name: "Hand in" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith(expect.stringMatching(/\/submit$/), { answers: [{ part_id: "w1", answer: "Sales rose by 20 percent in 2020." }] }));
    expect(await screen.findByText(/Your teacher will mark it/)).toBeTruthy();
  });

  it("shows Writing marks per criterion with comments and feedback", async () => {
    const task: IeltsPaperPart = { ...readingPart, id: "w1", module: "WRITING", groups: [] };
    get.mockReturnValue(
      ok(
        attempt(
          { module: "WRITING", status: "MARKED", band: 6.5, criteria: { tasks: [{ part_id: "w1", part_no: 1, criteria: { TA: 6, CC: 6.5, LR: 6, GRA: 6 }, band: 6, comment: "Add an overview." }] }, feedback: "Good progress." },
          { parts: [task], answers: { w1: "My essay" } },
        ),
      ),
    );
    renderApp(<IeltsAttemptScreen attemptId="at1" />);
    expect(await screen.findByText("Task band 6.0")).toBeTruthy();
    expect(screen.getByText("Coherence and Cohesion")).toBeTruthy();
    expect(screen.getByText("Add an overview.")).toBeTruthy();
    expect(screen.getByText("Good progress.")).toBeTruthy();
  });

  it("keeps every Reading passage on the page while another is shown (so highlights survive)", async () => {
    const second: IeltsPaperPart = { ...readingPart, id: "p2", part_no: 2, title: "Second passage", content: "<p>Another.</p>", groups: [] };
    get.mockReturnValue(ok(attempt({}, { parts: [readingPart, second] })));
    renderApp(<IeltsAttemptScreen attemptId="at1" />);
    await screen.findByRole("region", { name: "Passage" });
    fireEvent.click(screen.getByRole("button", { name: "Passage 2" }));
    const passages = document.querySelectorAll("[data-testid=passage]");
    expect(passages).toHaveLength(2);
    expect((passages[0].closest("[hidden]") as HTMLElement | null)?.hidden).toBe(true);
    expect(passages[1].closest("[hidden]")).toBeNull();
  });
});
