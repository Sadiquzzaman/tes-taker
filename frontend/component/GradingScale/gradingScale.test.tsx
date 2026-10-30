import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TIME_ZONE } from "@/i18n/config";
import { MESSAGES, renderApp } from "@/i18n/test-utils";
import { validateGradeBands } from "@/utils/gradingScale";
import StudentExamResults from "@/component/Tests/StudentExamResults";
import GradingScalePage from "./GradingScalePage";
import useScoreText, { type ScoreParts } from "./useScoreText";

const get = vi.fn();
const put = vi.fn();
const del = vi.fn();
const workspace = vi.fn();
const storedUser = vi.fn();
vi.mock("@/lib/authSession", () => ({ getStoredUser: () => storedUser(), clearAuthSession: vi.fn() }));
vi.mock("@/lib/axios", () => ({
  default: {
    get: (...args: unknown[]) => get(...args),
    put: (...args: unknown[]) => put(...args),
    delete: (...args: unknown[]) => del(...args),
  },
}));
vi.mock("@/hooks/organization/useWorkspace", () => ({ default: () => workspace() }));
const examResult = vi.fn();
vi.mock("@/hooks/api/exam/useGetExamResult", () => ({ default: () => examResult() }));

const ok = <T,>(payload: T) => Promise.resolve({ data: { payload } });
const BANGLADESH: GradingScale = {
  name: "Bangladesh national",
  is_custom: false,
  updated_at: null,
  bands: [
    { min_pct: 80, max_pct: 100, grade: "A+", gpa: 5 },
    { min_pct: 70, max_pct: 79.99, grade: "A", gpa: 4 },
    { min_pct: 60, max_pct: 69.99, grade: "A-", gpa: 3.5 },
    { min_pct: 50, max_pct: 59.99, grade: "B", gpa: 3 },
    { min_pct: 40, max_pct: 49.99, grade: "C", gpa: 2 },
    { min_pct: 33, max_pct: 39.99, grade: "D", gpa: 1 },
    { min_pct: 0, max_pct: 32.99, grade: "F", gpa: 0 },
  ],
};
const PASS_FAIL: GradingScale = {
  name: "English medium",
  is_custom: true,
  updated_at: "2026-10-30T10:00:00.000Z",
  bands: [
    { min_pct: 50, max_pct: 100, grade: "Pass", gpa: null },
    { min_pct: 0, max_pct: 49.99, grade: "Fail", gpa: null },
  ],
};
const asRole = (role: OrganizationMemberRole) =>
  workspace.mockReturnValue({
    workspace: { type: "organization", id: "org-1" },
    isIndividual: false,
    organizationId: "org-1",
    activeOrganization: { id: "org-1", name: "Green School", status: "approved", role },
  });

beforeEach(() => {
  vi.clearAllMocks();
  asRole("OWNER");
  storedUser.mockReturnValue({ session_mode: "organization", access_token: "token" });
});

afterEach(cleanup);

describe("grading scale checks (FND-11)", () => {
  it("accepts the Bangladesh scale and finds gaps, overlaps and repeated grades", () => {
    expect(validateGradeBands(BANGLADESH.bands)).toBeNull();
    expect(validateGradeBands([{ min_pct: 50, max_pct: 100, grade: "P", gpa: null }, { min_pct: 0, max_pct: 49, grade: "F", gpa: null }])).toEqual({
      code: "GRADING_SCALE_GAP_OR_OVERLAP",
      band: 0,
    });
    expect(validateGradeBands([{ min_pct: 0, max_pct: 100, grade: "P", gpa: null }, { min_pct: 0, max_pct: 100, grade: "p", gpa: null }])?.code).toBe(
      "GRADING_SCALE_DUPLICATE_GRADE",
    );
    expect(validateGradeBands([{ min_pct: 1, max_pct: 100, grade: "P", gpa: null }])?.code).toBe("GRADING_SCALE_MUST_START_AT_0");
    expect(validateGradeBands([{ min_pct: 0, max_pct: 99.99, grade: "P", gpa: null }])?.code).toBe("GRADING_SCALE_MUST_END_AT_100");
    expect(validateGradeBands([{ min_pct: 0, max_pct: Number.NaN, grade: "P", gpa: null }])?.code).toBe("GRADING_SCALE_BAND_INVALID");
    expect(validateGradeBands([])?.code).toBe("GRADING_SCALE_EMPTY");
  });
});

describe("score text", () => {
  const Score = (props: ScoreParts) => <span data-testid="score">{useScoreText()(props)}</span>;
  const renderScore = (props: ScoreParts, locale: "en" | "bn" = "en") =>
    render(
      <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]} timeZone={TIME_ZONE}>
        <Score {...props} />
      </NextIntlClientProvider>,
    );

  it('shows marks with percentage and grade, e.g. "64/80 · 80% (A+)"', () => {
    renderScore({ score: 64, max: 80, percentage: 80, grade: { grade: "A+", gpa: 5 } });
    expect(screen.getByTestId("score").textContent).toBe("64/80 · 80% (A+)");
  });

  it("uses Bangla digits in Bangla", () => {
    renderScore({ score: 64, max: 80, percentage: 80, grade: { grade: "A+", gpa: 5 } }, "bn");
    expect(screen.getByTestId("score").textContent).toBe("৬৪/৮০ · ৮০% (A+)");
  });

  it("reads numbers sent as text, works out the percentage, and shows a dash without marks", () => {
    renderScore({ score: "8.00", max: "10.00" });
    expect(screen.getByTestId("score").textContent).toBe("8/10 · 80%");
    cleanup();
    renderScore({ score: null, max: 10 });
    expect(screen.getByTestId("score").textContent).toBe("—");
  });
});

describe("grading scale page", () => {
  it("lets the owner edit the bands and saves them", async () => {
    get.mockReturnValue(ok(BANGLADESH));
    put.mockReturnValue(ok(PASS_FAIL));
    renderApp(<GradingScalePage />);

    expect(await screen.findByText("Bangladesh national (default)")).toBeTruthy();
    expect((screen.getByLabelText("Grade (band 1)") as HTMLInputElement).value).toBe("A+");
    expect(screen.queryByRole("button", { name: "Reset to Bangladesh default" })).toBeNull();

    // Two bands: Pass from 50%, Fail below.
    for (let row = 7; row > 2; row--) fireEvent.click(screen.getByRole("button", { name: `Remove band ${row}` }));
    fireEvent.change(screen.getByLabelText("From (band 1)"), { target: { value: "50" } });
    fireEvent.change(screen.getByLabelText("Grade (band 1)"), { target: { value: "Pass" } });
    fireEvent.change(screen.getByLabelText("GPA (band 1, optional)"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("From (band 2)"), { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText("To (band 2)"), { target: { value: "49.99" } });
    fireEvent.change(screen.getByLabelText("Grade (band 2)"), { target: { value: "Fail" } });
    fireEvent.change(screen.getByLabelText("GPA (band 2, optional)"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Scale name"), { target: { value: "English medium" } });
    fireEvent.click(screen.getByRole("button", { name: "Save scale" }));

    await waitFor(() =>
      expect(put).toHaveBeenCalledWith(expect.stringMatching(/\/grading-scale$/), {
        name: "English medium",
        bands: [
          { min_pct: 50, max_pct: 100, grade: "Pass", gpa: null },
          { min_pct: 0, max_pct: 49.99, grade: "Fail", gpa: null },
        ],
      }),
    );
    expect(await screen.findByText("Grading scale saved")).toBeTruthy();
    expect(screen.getByText("English medium", { selector: "span" })).toBeTruthy();
  });

  it("shows what is wrong on the band before saving", async () => {
    get.mockReturnValue(ok(BANGLADESH));
    renderApp(<GradingScalePage />);

    fireEvent.change(await screen.findByLabelText("To (band 2)"), { target: { value: "78" } });
    fireEvent.click(screen.getByRole("button", { name: "Save scale" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Band 1: each band must start 0.01% above the one below it, with no gap or overlap.");
    expect(put).not.toHaveBeenCalled();
  });

  it("shows the API's check in the reader's language", async () => {
    get.mockReturnValue(ok(BANGLADESH));
    put.mockRejectedValue({ response: { status: 400, data: { code: "GRADING_SCALE_DUPLICATE_GRADE", message: "Each grade can be used once" } } });
    renderApp(<GradingScalePage />, { locale: "bn" });

    fireEvent.click(await screen.findByRole("button", { name: "স্কেল সংরক্ষণ" }));
    expect((await screen.findByRole("alert")).textContent).toContain("এই গ্রেড আগেই ব্যবহার হয়েছে");
  });

  it("goes back to the Bangladesh default after confirming", async () => {
    get.mockReturnValue(ok(PASS_FAIL));
    del.mockReturnValue(ok(BANGLADESH));
    renderApp(<GradingScalePage />);

    fireEvent.click(await screen.findByRole("button", { name: "Reset to Bangladesh default" }));
    const dialog = await screen.findByRole("dialog");
    expect(del).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Reset to Bangladesh default" }));

    await waitFor(() => expect(del).toHaveBeenCalledWith(expect.stringMatching(/\/grading-scale$/)));
    expect(await screen.findByText("Bangladesh national (default)")).toBeTruthy();
  });

  it("shows teachers the scale without editing", async () => {
    asRole("TEACHER");
    get.mockReturnValue(ok(PASS_FAIL));
    renderApp(<GradingScalePage />);

    expect(await screen.findByText("Only owners and admins can change the grading scale.")).toBeTruthy();
    expect(screen.getAllByText("Pass").length).toBeGreaterThan(0);
    expect(screen.queryByLabelText("Grade (band 1)")).toBeNull();
    expect(screen.queryByRole("button", { name: "Save scale" })).toBeNull();
  });
});

describe("student result", () => {
  it("shows the score with percentage and grade, and the grade with its GPA", () => {
    examResult.mockReturnValue({
      loading: false,
      error: null,
      refetch: vi.fn(),
      result: {
        exam_id: "e1",
        subject: "Physics",
        submitted_at: null,
        total_score: 64,
        max_score: 80,
        percentage: 80,
        grade: { grade: "A+", gpa: 5 },
        questions: [],
        totals: { manual_total_count: 0, manual_graded_count: 0, auto_total_count: 0, auto_graded_count: 0 },
        submission: { submission_id: "s1", exam_id: "e1", total_score: 64, max_score: 80, percentage: 80, is_graded: true, grading_status: "GRADED" },
      },
    });
    renderApp(<StudentExamResults examId="e1" />);
    expect(screen.getByText("64/80 · 80% (A+)")).toBeTruthy();
    expect(screen.getByText("A+ · 5.00")).toBeTruthy();
  });
});
