import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/i18n/test-utils";
import Examiner from "./Examiner";
import SpeakingPart from "./SpeakingPart";

const get = vi.fn();
const put = vi.fn();
vi.mock("@/lib/axios", () => ({ default: { get: (...a: unknown[]) => get(...a), put: (...a: unknown[]) => put(...a) } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/ielts/speaking/a1" }));
vi.mock("@/component/RichTextEditor", () => ({ RichTextContent: ({ html }: { html: string }) => <div>{html}</div> }));
vi.mock("@/utils/media/uploadMedia", () => ({ uploadMedia: vi.fn() }));

const ok = <T,>(payload: T) => Promise.resolve({ data: { payload } });
const view: IeltsMarkingView = {
  attempt_id: "a1",
  module: "SPEAKING",
  status: "IN_PROGRESS",
  mode: "LIVE",
  student: { id: "u1", full_name: "Mitu" },
  test: { id: "t1", title: "Mock 3" },
  batch: "Band 7 Course A",
  submitted_at: null,
  band: null,
  test_type: "ACADEMIC",
  tasks: [1, 2, 3].map((no) => ({ part_id: `p${no}`, part_no: no, title: null, content: `<p>Part ${no} questions</p>`, image_file_id: null, script: "", words: 0, min_words: 0, recording_file_id: no === 1 ? "f1" : null })),
  marks: [],
  speaking: null,
  feedback: null,
  marked_by: null,
  marked_at: null,
};

beforeEach(() => {
  get.mockReset().mockReturnValue(ok(view));
  put.mockReset().mockReturnValue(ok({ ...view, status: "MARKED", band: 6.5, speaking: { FC: 6.5, LR: 6, GRA: 6, P: 7 } }));
});
afterEach(() => cleanup());

describe("IELTS Speaking (IEL-07)", () => {
  it("runs Part 2's preparation timer and says when the browser cannot record", async () => {
    renderApp(<SpeakingPart part={{ id: "p2", part_no: 2, title: null, content: "<p>Describe a place</p>" }} recordingId={null} onRecorded={async () => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "Start 1 minute to prepare" }));
    expect(screen.getByRole("timer", { name: "Preparation time" }).textContent).toMatch(/1:00/);
    fireEvent.click(screen.getByRole("button", { name: "Record" }));
    expect(await screen.findByText(/This browser cannot record/)).toBeTruthy();
  });

  it("lets the examiner mark the four criteria and end the live session", async () => {
    renderApp(<Examiner attemptId="a1" />);
    expect(await screen.findByText("Speaking with Mitu")).toBeTruthy();
    expect(screen.getByLabelText("Recording of Part 1")).toBeTruthy();
    const marks = within(screen.getByRole("region", { name: "Marks" }));
    const save = marks.getByRole("button", { name: "Save marks and end the session" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    for (const [label, value] of [["Fluency and Coherence", "6.5"], ["Lexical Resource", "6"], ["Grammatical Range and Accuracy", "6"], ["Pronunciation", "7"]]) {
      fireEvent.change(marks.getByLabelText(label), { target: { value } });
    }
    expect(marks.getByText("Speaking band 6.5")).toBeTruthy(); // 6.375 → 6.5
    fireEvent.change(marks.getByLabelText("Notes for the student"), { target: { value: "Extend Part 3." } });
    fireEvent.click(save);
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith(expect.stringMatching(/\/ielts\/marking\/a1\/speaking$/), { criteria: { FC: 6.5, LR: 6, GRA: 6, P: 7 }, feedback: "Extend Part 3." }),
    );
  });
});
