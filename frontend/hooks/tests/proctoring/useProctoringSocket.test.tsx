import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useProctoringSocket from "./useProctoringSocket";

type Handler = (...args: unknown[]) => void;
const handlers = new Map<string, Handler>();
const emit = vi.fn();
const fakeSocket = { connected: true, connect: vi.fn(), on: (event: string, handler: Handler) => handlers.set(event, handler), emit, disconnect: vi.fn(), removeAllListeners: vi.fn(), off: vi.fn() };
vi.mock("socket.io-client", () => ({ io: () => fakeSocket }));
vi.mock("@/hooks/api/exam/useReportStudentExamViolation", () => ({ default: () => vi.fn() }));
vi.mock("@/utils/tests/proctoringSocket", () => ({ getProctoringSocketUrl: () => "http://socket.test" }));

const flag: ProctoringFlag = { id: "flag-1", type: "tab-switch", message: "Left the tab", points: 1, timestamp: "2026-11-13T05:00:00Z" };

beforeEach(() => {
  localStorage.setItem("user", JSON.stringify({ id: "st1", full_name: "Mitu", access_token: "token" }));
  vi.useFakeTimers();
  handlers.clear();
  emit.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

describe("live proctoring channel (P8-02)", () => {
  it("says it is still there every 15 seconds, and sends each flag with its own id and kind", () => {
    const { result, rerender } = renderHook((props: { flags: ProctoringFlag[] }) =>
      useProctoringSocket({ answerSheet: {}, examId: "x1", flags: props.flags, isEnabled: true, totalFlagPoints: 0 }),
      { initialProps: { flags: [] as ProctoringFlag[] } },
    );
    act(() => {
      vi.advanceTimersByTime(1);
      result.current.connectToSocket();
    });
    act(() => handlers.get("connect")?.());
    act(() => handlers.get("session:ready")?.());
    expect(emit).toHaveBeenCalledWith("heartbeat");
    const beats = () => emit.mock.calls.filter(([event]) => event === "heartbeat").length;
    const before = beats();
    act(() => vi.advanceTimersByTime(45_000));
    expect(beats()).toBe(before + 3);

    rerender({ flags: [flag] });
    expect(emit).toHaveBeenCalledWith("flag:report", { examId: "x1", id: "flag-1", kind: "tab-switch", type: "TAB_SWITCH", message: "Left the tab", points: 1 });
  });

  it("passes on the teacher's warning and the end of the exam (P8-03)", () => {
    const onTeacherWarning = vi.fn();
    const onExamEnded = vi.fn();
    const { result } = renderHook(() =>
      useProctoringSocket({ answerSheet: {}, examId: "x1", flags: [], isEnabled: true, totalFlagPoints: 0, onTeacherWarning, onExamEnded }),
    );
    act(() => {
      vi.advanceTimersByTime(1);
      result.current.connectToSocket();
    });
    act(() => handlers.get("proctor:warning")?.({ message: "Eyes on your screen.", from: "Rina" }));
    act(() => handlers.get("exam:ended")?.({ reason: "Talking off camera" }));
    expect(onTeacherWarning).toHaveBeenCalledWith({ message: "Eyes on your screen.", from: "Rina" });
    expect(onExamEnded).toHaveBeenCalledWith("Talking off camera");
  });
});
