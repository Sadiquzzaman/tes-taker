import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/i18n/test-utils";
import proctoringReducer, { addFlag, resetProctoring, setProctoringFeatures, startProctoring } from "@/lib/features/proctoringSlice";
import { countsTowardsLimit, proctoringFeaturesOf } from "@/utils/tests/proctoringLevel";
import ProctoringSettingsCard from "../Create/ProctoringSettingsCard";
import StudentExamPermissionFlow from "./StudentExamPermissionFlow";

const get = vi.fn();
const replace = vi.fn();
const setExamMediaStreams = vi.fn();
vi.mock("@/lib/axios", () => ({ default: { get: (...args: unknown[]) => get(...args) } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn() }), usePathname: () => "/test/permissions" }));
vi.mock("@/utils/tests/examSessionMedia", () => ({ setExamMediaStreams: (...args: unknown[]) => setExamMediaStreams(...args), markExamPermissionsComplete: vi.fn() }));
vi.mock("@/hooks/tests/proctoring/useExamPermissions", () => ({
  default: () => ({ cameraStream: null, permissionState: { camera: "prompt", microphone: "prompt" }, errorMessage: null, allPermissionsGranted: false, requestCameraAndMicrophone: vi.fn() }),
}));

const ok = <T,>(payload: T) => Promise.resolve({ data: { payload } });
const BROWSER = ["proctoring_tab_switch", "proctoring_fullscreen_exit", "proctoring_page_refresh"];
const options = (pro = false): ProctoringOptions => ({
  levels: [
    { level: "OFF", available: true, checks: [] },
    { level: "LIGHT", available: true, checks: BROWSER },
    { level: "STRICT", available: pro, checks: pro ? [...BROWSER, "proctoring_no_face", "proctoring_phone"] : BROWSER },
  ],
  auto_disqualify_available: pro,
  default_level: pro ? "STRICT" : "LIGHT",
});

beforeEach(() => {
  get.mockReset();
  replace.mockReset();
  setExamMediaStreams.mockReset();
});
afterEach(() => cleanup());

describe("proctoring settings on a test (PRO-01, PRO-02)", () => {
  it("offers the plan's levels, switches checks off, and keeps auto-disqualify off where the plan lacks it", async () => {
    get.mockReturnValue(ok(options()));
    const onChange = vi.fn();
    renderApp(<ProctoringSettingsCard value={null} onChange={onChange} />);
    const strict = (await screen.findByRole("radio", { name: /Strict/ })) as HTMLInputElement;
    expect(strict.disabled).toBe(true);
    expect((screen.getByRole("radio", { name: /Light/ }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText("3 checks run in the browser; no camera.")).toBeTruthy();
    expect((screen.getByLabelText(/Disqualify automatically/) as HTMLInputElement).disabled).toBe(true);
    fireEvent.click(screen.getByLabelText("Page reload detection"));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ level: "LIGHT", checks_off: ["proctoring_page_refresh"], auto_disqualify: false }));
  });

  it("sets the number of flags and which checks count when auto-disqualify is on", async () => {
    get.mockReturnValue(ok(options(true)));
    const onChange = vi.fn();
    const value: ExamProctoringChoice = { level: "STRICT", checks_off: [], auto_disqualify: true, disqualify_threshold: 5, disqualify_checks: null };
    renderApp(<ProctoringSettingsCard value={value} onChange={onChange} />);
    expect(await screen.findByText("Students are warned at 3 flags.")).toBeTruthy();
    expect(screen.getByText(/students turn on camera and microphone/)).toBeTruthy();
    const counted = within(screen.getByRole("group", { name: "Flags that count" }));
    fireEvent.click(counted.getByLabelText("Phone detection"));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ disqualify_checks: [...BROWSER, "proctoring_no_face"] }));
  });
});

describe("alerts (PRO-08)", () => {
  it("lets the teacher ask for an alert at a number of flags, where the plan has alerts", async () => {
    get.mockReturnValue(ok({ ...options(true), alerts_available: true }));
    const onChange = vi.fn();
    renderApp(<ProctoringSettingsCard value={{ level: "STRICT", checks_off: [], auto_disqualify: false, disqualify_threshold: 15, disqualify_checks: null, alert_flags: null }} onChange={onChange} />);
    fireEvent.click(await screen.findByLabelText(/Alert me during the test/));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ alert_flags: 5 }));
    cleanup();
    get.mockReturnValue(ok(options(true)));
    renderApp(<ProctoringSettingsCard value={null} onChange={vi.fn()} />);
    await screen.findByRole("radio", { name: /Strict/ });
    expect(screen.queryByLabelText(/Alert me during the test/)).toBeNull();
  });
});

describe("before the test (PRO-01: the student sees which checks are active)", () => {
  it("goes straight to the rules for a Light test, lists what is watched, and asks for no camera", async () => {
    const proctoring: EffectiveProctoring = { level: "LIGHT", checks: ["proctoring_tab_switch"], camera: false, auto_disqualify: null };
    renderApp(<StudentExamPermissionFlow proctoring={proctoring} />);
    expect(screen.queryByText("Camera Device")).toBeNull();
    expect(screen.queryByText("Stay camera and mic on.")).toBeNull();
    expect(screen.getByText(/Flags are recorded for your teacher to review/)).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Watched during this test" })).getByText("Tab switch detection")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("I read and understand the rules."));
    fireEvent.click(screen.getByRole("button", { name: "Start Test" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/test"));
    expect(setExamMediaStreams).toHaveBeenCalledWith(null, null);
  });

  it("asks for the camera first for a Strict test, and states the limit and the warning", () => {
    const proctoring: EffectiveProctoring = { level: "STRICT", checks: ["proctoring_no_face"], camera: true, auto_disqualify: { threshold: 5, warn_at: 3, checks: ["proctoring_no_face"] } };
    renderApp(<StudentExamPermissionFlow proctoring={proctoring} />);
    expect(screen.getByText("Camera Device")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Next Step" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("the limit during the test (PRO-02)", () => {
  const flag = (type: ProctoringFlagType) => addFlag({ type, message: type });

  it("counts only the chosen checks, warns at the warning point and disqualifies at the threshold", () => {
    let state = proctoringReducer(undefined, setProctoringFeatures({ autoDisqualify: { threshold: 3, warn_at: 2, checks: ["proctoring_phone"] } }));
    state = proctoringReducer(state, resetProctoring());
    state = proctoringReducer(state, startProctoring());
    state = proctoringReducer(state, flag("tab-switch"));
    expect([state.countedFlags, state.isDisqualified]).toEqual([0, false]);
    state = proctoringReducer(state, flag("phone-detected"));
    state = proctoringReducer(state, flag("phone-detected"));
    expect(state.pendingWarning?.limit).toEqual({ count: 2, threshold: 3 });
    state = proctoringReducer(state, flag("phone-detected"));
    expect(state.isDisqualified).toBe(true);
  });

  it("never disqualifies when the test does not auto-disqualify", () => {
    let state = proctoringReducer(undefined, setProctoringFeatures({ autoDisqualify: null }));
    state = proctoringReducer(state, startProctoring());
    for (let i = 0; i < 30; i += 1) state = proctoringReducer(state, flag("tab-switch"));
    expect([state.flags.length, state.isDisqualified]).toEqual([30, false]);
  });

  it("turns on only the test's checks, and the camera only for Strict", () => {
    const features = proctoringFeaturesOf({ level: "LIGHT", checks: ["proctoring_tab_switch"], camera: false, auto_disqualify: null });
    expect([features.proctoring_tab_switch, features.proctoring_no_face, features.proctoring_video_monitoring]).toEqual([true, false, false]);
    expect([countsTowardsLimit("screen-sharing", null), countsTowardsLimit("screen-sharing", ["proctoring_phone"])]).toEqual([true, false]);
  });
});
