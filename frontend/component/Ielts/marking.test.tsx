import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/i18n/test-utils";
import { MarkingList, MarkWriting } from "./Marking";

const get = vi.fn();
const put = vi.fn();
const push = vi.fn();
vi.mock("@/lib/axios", () => ({ default: { get: (...a: unknown[]) => get(...a), put: (...a: unknown[]) => put(...a) } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => "/ielts/marking" }));
vi.mock("@/component/RichTextEditor", () => ({ RichTextContent: ({ html }: { html: string }) => <div>{html}</div> }));

const ok = <T,>(payload: T) => Promise.resolve({ data: { payload } });
const row: IeltsMarkingRow = { attempt_id: "a1", module: "WRITING", status: "SUBMITTED", student: { id: "u1", full_name: "Mitu" }, test: { id: "t1", title: "Mock 3" }, batch: "Band 7 Course A", submitted_at: "2026-11-16T05:00:00Z", band: null };
const view: IeltsMarkingView = {
  ...row,
  test_type: "ACADEMIC",
  tasks: [
    { part_id: "w1", part_no: 1, title: null, content: "<p>Chart</p>", image_file_id: null, script: "Short script", words: 2, min_words: 150 },
    { part_id: "w2", part_no: 2, title: null, content: "<p>Essay</p>", image_file_id: null, script: "Essay script", words: 260, min_words: 250 },
  ],
  marks: [],
  feedback: null,
  marked_by: null,
  marked_at: null,
};

beforeEach(() => {
  push.mockReset();
  put.mockReset().mockReturnValue(ok({ ...view, status: "MARKED", band: 6.5 }));
  get.mockImplementation((url: string) => (url.endsWith("/ielts/marking") ? ok([row]) : ok(view)));
});
afterEach(() => cleanup());

describe("IELTS Writing marking (IEL-06)", () => {
  it("lists Writing waiting to be marked", async () => {
    renderApp(<MarkingList />);
    const table = within(await screen.findByRole("table", { name: "Writing to mark" }));
    expect(table.getAllByText("Band 7 Course A").length).toBeGreaterThan(0);
    fireEvent.click(table.getAllByRole("button", { name: "Mark Mitu's Writing" })[0]);
    expect(push).toHaveBeenCalledWith("/ielts/marking/a1");
  });

  it("marks the four criteria per task and shows each task's band", async () => {
    renderApp(<MarkWriting attemptId="a1" />);
    const task1 = within(await screen.findByRole("region", { name: "Task 1" }));
    expect(task1.getByText(/2 words · fewer than 150/)).toBeTruthy();
    const save = screen.getByRole("button", { name: "Save marks" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    for (const [label, value] of [["Task Achievement", "6"], ["Coherence and Cohesion", "6"], ["Lexical Resource", "5.5"], ["Grammatical Range and Accuracy", "5.5"]]) {
      fireEvent.change(task1.getByLabelText(label), { target: { value } });
    }
    expect(task1.getByText("Task band 6.0")).toBeTruthy(); // 5.75 → 6
    const task2 = within(screen.getByRole("region", { name: "Task 2" }));
    for (const label of ["Task Response", "Coherence and Cohesion", "Lexical Resource", "Grammatical Range and Accuracy"]) {
      fireEvent.change(task2.getByLabelText(label), { target: { value: "7" } });
    }
    fireEvent.change(task1.getByLabelText("Comment on this task"), { target: { value: "Add an overview." } });
    fireEvent.click(save);
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith(expect.stringMatching(/\/ielts\/marking\/a1\/writing$/), {
        tasks: [
          { part_id: "w1", criteria: { TA: 6, CC: 6, LR: 5.5, GRA: 5.5 }, comment: "Add an overview." },
          { part_id: "w2", criteria: { TR: 7, CC: 7, LR: 7, GRA: 7 }, comment: undefined },
        ],
        feedback: undefined,
      }),
    );
    expect(await screen.findByText("Writing band")).toBeTruthy();
  });
});
