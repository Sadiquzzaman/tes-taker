import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/i18n/test-utils";
import IeltsTestBuilder from "./IeltsTestBuilder";

const get = vi.fn();
const post = vi.fn();
const put = vi.fn();
const patch = vi.fn();
const del = vi.fn();
vi.mock("@/lib/axios", () => ({
  default: {
    get: (...a: unknown[]) => get(...a),
    post: (...a: unknown[]) => post(...a),
    put: (...a: unknown[]) => put(...a),
    patch: (...a: unknown[]) => patch(...a),
    delete: (...a: unknown[]) => del(...a),
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/ielts/tests/t1" }));
// The real editor (TipTap) is covered by its own tests; a textarea stands in here.
vi.mock("@/component/RichTextEditor", () => ({
  RichTextEditor: ({ value, onChange }: { value: string; onChange: (html: string) => void }) => <textarea aria-label="Rich text" value={value} onChange={(e) => onChange(e.target.value)} />,
  RichTextContent: ({ html }: { html: string }) => <div>{html}</div>,
}));
vi.mock("@/utils/media/uploadMedia", () => ({ uploadMedia: vi.fn() }));

const ok = <T,>(payload: T) => Promise.resolve({ data: { payload } });
const part = (module: IeltsModule, no: number, extra: Partial<IeltsPart> = {}): IeltsPart => ({
  id: `${module}-${no}`,
  module,
  part_no: no,
  title: null,
  content: null,
  audio_file_id: null,
  image_file_id: null,
  groups: [],
  ...extra,
});
const noteGroup: IeltsGroup = {
  id: "g1",
  type: "NOTE_COMPLETION",
  instruction: "Write ONE WORD.",
  word_limit: 1,
  shared: { text: "Hotel on [[1]] Road" },
  image_file_id: null,
  sort_order: 1,
  number_from: 1,
  number_to: 2,
  questions: [
    { id: "q1", sort_order: 1, number_from: 1, number_to: 1, prompt: null, options: null, answer: { accepted: ["Sea"] } },
    { id: "q2", sort_order: 2, number_from: 2, number_to: 2, prompt: "Room", options: null, answer: { accepted: ["21"] } },
  ],
};
const test = (extra: Partial<IeltsTest> = {}): IeltsTest => ({
  id: "t1",
  title: "Mock 1",
  test_type: "ACADEMIC",
  purpose: "MOCK",
  modules: ["LISTENING", "READING"],
  durations: { LISTENING: 1800, READING: 3600 },
  status: "DRAFT",
  needs_review: false,
  created_by: { id: "u1", full_name: "Tania" },
  updated_at: "2026-11-15T10:00:00Z",
  can_edit: true,
  parts: [part("LISTENING", 1, { groups: [noteGroup] }), part("LISTENING", 2), part("READING", 1)],
  ...extra,
});

beforeEach(() => {
  get.mockReset().mockReturnValue(ok(test()));
  post.mockReset().mockReturnValue(ok(test()));
  put.mockReset().mockReturnValue(ok(test()));
  patch.mockReset().mockReturnValue(ok(test()));
  del.mockReset().mockReturnValue(ok(test()));
});
afterEach(() => cleanup());

describe("IELTS test builder (IEL-03)", () => {
  it("shows parts with numbered groups and says what is missing before publishing", async () => {
    post.mockImplementation(() =>
      Promise.reject({
        response: { status: 422, data: { code: "IELTS_TEST_INCOMPLETE", details: { problems: [{ module: "LISTENING", part_no: 2, problem: "NO_RECORDING" }, { module: "READING", part_no: null, problem: "NOT_40", count: 12 }] } } },
      }),
    );
    renderApp(<IeltsTestBuilder testId="t1" />);
    const listening1 = within(await screen.findByRole("region", { name: "Part 1" }));
    expect(listening1.getByText("Questions 1–2")).toBeTruthy();
    expect(listening1.getByText("No recording yet.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    const missing = within(await screen.findByRole("list", { name: "Not ready to publish yet" }));
    expect(missing.getByText("Part 2 of Listening: add the recording.")).toBeTruthy();
    expect(missing.getByText("Reading: 12 of 40 questions so far.")).toBeTruthy();
  });

  it("saves a group keeping its questions’ ids and accepted answers", async () => {
    renderApp(<IeltsTestBuilder testId="t1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit group 1" }));
    const drawer = within(await screen.findByRole("dialog", { name: "Edit question group" }));
    fireEvent.change(drawer.getAllByLabelText(/Accepted answers/)[0], { target: { value: "sea" } });
    fireEvent.click(drawer.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith(expect.stringMatching(/\/ielts\/tests\/t1\/groups\/g1$/), {
        type: "NOTE_COMPLETION",
        instruction: "Write ONE WORD.",
        word_limit: 1,
        shared: { text: "Hotel on [[1]] Road" },
        image_file_id: null,
        questions: [
          { id: "q1", prompt: null, options: null, answer: { accepted: ["Sea", "sea"] } },
          { id: "q2", prompt: "Room", options: null, answer: { accepted: ["21"] } },
        ],
      }),
    );
  });

  it("adds a True / False / Not Given group to a Reading passage", async () => {
    renderApp(<IeltsTestBuilder testId="t1" />);
    fireEvent.click(await screen.findByRole("tab", { name: "Reading" }));
    const passage = within(await screen.findByRole("region", { name: "Passage 1" }));
    fireEvent.click(passage.getByRole("button", { name: "Add question group" }));
    const drawer = within(await screen.findByRole("dialog", { name: "Add question group" }));
    fireEvent.change(drawer.getByLabelText("Question type"), { target: { value: "TFNG" } });
    fireEvent.change(drawer.getByLabelText("Instruction"), { target: { value: "Do the statements agree?" } });
    fireEvent.change(drawer.getByLabelText("Question"), { target: { value: "The museum is free." } });
    fireEvent.change(drawer.getByLabelText("Right answer"), { target: { value: "NOT GIVEN" } });
    fireEvent.click(drawer.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(expect.stringMatching(/\/ielts\/tests\/t1\/parts\/READING-1\/groups$/), {
        type: "TFNG",
        instruction: "Do the statements agree?",
        word_limit: null,
        shared: null,
        image_file_id: null,
        questions: [{ prompt: "The museum is free.", options: null, answer: { keys: ["NOT GIVEN"] } }],
      }),
    );
  });

  it("keeps published tests read-only until moved back to drafts", async () => {
    get.mockReturnValue(ok(test({ status: "PUBLISHED" })));
    renderApp(<IeltsTestBuilder testId="t1" />);
    expect(await screen.findByText(/Move the test to drafts to change it/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Publish" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit group 1" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Move to drafts" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith(expect.stringMatching(/\/ielts\/tests\/t1\/unpublish$/)));
  });
});
