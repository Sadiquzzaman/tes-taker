import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/i18n/test-utils";
import PrintPaperDrawer from "./PrintPaperDrawer";

const downloadPaper = vi.fn();
const downloadKey = vi.fn();
vi.mock("@/utils/exam/downloadExamQuestionsPdf", () => ({
  downloadExamQuestionsPdf: (...args: unknown[]) => downloadPaper(...args),
  downloadAnswerKeyPdf: (...args: unknown[]) => downloadKey(...args),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/tests/e1" }));

const question = (id: string) =>
  ({ id, type: "graded", subType: "multiple-choice", text: id, instruction: null, image: null, points: 1, showValidation: false, options: [{ id: `${id}-a`, text: "a", image: null }, { id: `${id}-b`, text: "b", image: null }], correctOptionId: `${id}-b` }) as unknown as StudentExamStandardQuestion;
const exam = {
  id: "e1",
  test_name: "Physics",
  class_name: "9A",
  formState: { duration: 45 },
  subjects: [{ id: "s1", name: "Physics", code: null, questions: ["q1", "q2", "q3", "q4"].map(question) }],
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("print the paper (QA-05)", () => {
  it("downloads the chosen set on the chosen paper, with the school's name and the answer key", async () => {
    const onClose = vi.fn();
    renderApp(<PrintPaperDrawer open onClose={onClose} exam={exam} organizationName="Sunrise School" />);
    const drawer = within(await screen.findByRole("dialog", { name: "Print the paper" }));
    fireEvent.click(drawer.getByLabelText(/Set B/));
    fireEvent.click(drawer.getByLabelText("Legal"));
    fireEvent.click(drawer.getByRole("button", { name: "Download PDF" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());

    expect(downloadPaper).toHaveBeenCalledWith(expect.objectContaining({ testName: "Physics", paper: "legal", setLabel: "B", organizationName: "Sunrise School", durationMinutes: 45 }));
    const printed = downloadPaper.mock.calls[0][0].subjects[0].questions.map((q: { id: string }) => q.id);
    expect([...printed].sort()).toEqual(["q1", "q2", "q3", "q4"]);
    expect(downloadKey).toHaveBeenCalledWith(expect.objectContaining({ setLabel: "B", paper: "legal", key: [expect.objectContaining({ rows: expect.arrayContaining([expect.objectContaining({ number: 1 })]) })] }));
  });

  it("leaves the answer key out when asked, and set A keeps the order", async () => {
    renderApp(<PrintPaperDrawer open onClose={vi.fn()} exam={exam} />);
    const drawer = within(await screen.findByRole("dialog", { name: "Print the paper" }));
    fireEvent.click(drawer.getByLabelText(/Answer key too/));
    fireEvent.click(drawer.getByRole("button", { name: "Download PDF" }));
    await waitFor(() => expect(downloadPaper).toHaveBeenCalled());
    expect(downloadPaper.mock.calls[0][0].subjects[0].questions.map((q: { id: string }) => q.id)).toEqual(["q1", "q2", "q3", "q4"]);
    expect(downloadKey).not.toHaveBeenCalled();
  });
});
