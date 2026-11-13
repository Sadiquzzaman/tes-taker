import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useAnswerSync, { changedAnswers, FIRST_RETRY_MS, SYNC_DELAY_MS } from "./useAnswerSync";

const put = vi.fn();
vi.mock("@/lib/axios", () => ({ default: { put: (...args: unknown[]) => put(...args) } }));

const offline = () => Object.assign(new Error("Network Error"), { response: undefined });
const timeUp = () => Object.assign(new Error("Forbidden"), { response: { status: 403 } });
/** Lets pending promises (the PUT) settle. */
const settle = () => act(async () => undefined);

beforeEach(() => {
  vi.useFakeTimers();
  put.mockReset();
});
afterEach(() => vi.useRealTimers());

describe("answers sent from the device (PRO-09)", () => {
  it("sends only what changed, a few seconds after the student pauses", async () => {
    put.mockResolvedValue({ data: {} });
    const { result, rerender } = renderHook(({ answers }) => useAnswerSync({ examId: "e1", answers, enabled: true }), {
      initialProps: { answers: { q1: "", q2: "" } as ExamAnswerState },
    });
    // Empty answers that were never sent are not news.
    expect(result.current.status).toBe("idle");

    rerender({ answers: { q1: "A", q2: "" } });
    expect(result.current.status).toBe("device");
    act(() => vi.advanceTimersByTime(SYNC_DELAY_MS - 1));
    expect(put).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    await settle();
    expect(put).toHaveBeenLastCalledWith(expect.stringMatching(/\/student\/exams\/e1\/answersheet$/), { answersheet: { q1: "A" } });
    expect(result.current.status).toBe("server");

    rerender({ answers: { q1: "A", q2: "Light bends." } });
    act(() => vi.advanceTimersByTime(SYNC_DELAY_MS));
    await settle();
    expect(put).toHaveBeenLastCalledWith(expect.any(String), { answersheet: { q2: "Light bends." } });

    // Clearing an answer sends it empty, so the server clears it too.
    rerender({ answers: { q1: "", q2: "Light bends." } });
    act(() => vi.advanceTimersByTime(SYNC_DELAY_MS));
    await settle();
    expect(put).toHaveBeenLastCalledWith(expect.any(String), { answersheet: { q1: "" } });
    expect(put).toHaveBeenCalledTimes(3);
  });

  it("keeps answers on the device while offline and sends them when the connection is back", async () => {
    put.mockRejectedValueOnce(offline()).mockResolvedValue({ data: {} });
    const { result, rerender } = renderHook(({ answers }) => useAnswerSync({ examId: "e1", answers, enabled: true }), {
      initialProps: { answers: {} as ExamAnswerState },
    });
    rerender({ answers: { q1: "B" } });
    act(() => vi.advanceTimersByTime(SYNC_DELAY_MS));
    await settle();
    expect(result.current.status).toBe("device");

    // Back online before the retry: sent at once.
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    await settle();
    expect(put).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe("server");
  });

  it("retries with a growing pause while the connection is down", async () => {
    put.mockRejectedValueOnce(offline()).mockRejectedValueOnce(offline()).mockResolvedValue({ data: {} });
    const { result, rerender } = renderHook(({ answers }) => useAnswerSync({ examId: "e1", answers, enabled: true }), {
      initialProps: { answers: {} as ExamAnswerState },
    });
    rerender({ answers: { q1: "C" } });
    act(() => vi.advanceTimersByTime(SYNC_DELAY_MS));
    await settle();
    act(() => vi.advanceTimersByTime(FIRST_RETRY_MS));
    await settle();
    expect(put).toHaveBeenCalledTimes(2);
    act(() => vi.advanceTimersByTime(FIRST_RETRY_MS));
    await settle();
    expect(put).toHaveBeenCalledTimes(2);
    act(() => vi.advanceTimersByTime(FIRST_RETRY_MS));
    await settle();
    expect(put).toHaveBeenCalledTimes(3);
    expect(result.current.status).toBe("server");
  });

  it("stops when time is up: the server keeps what it has", async () => {
    put.mockRejectedValue(timeUp());
    const { result, rerender } = renderHook(({ answers }) => useAnswerSync({ examId: "e1", answers, enabled: true }), {
      initialProps: { answers: {} as ExamAnswerState },
    });
    rerender({ answers: { q1: "D" } });
    act(() => vi.advanceTimersByTime(SYNC_DELAY_MS));
    await settle();
    rerender({ answers: { q1: "E" } });
    act(() => vi.advanceTimersByTime(10 * SYNC_DELAY_MS));
    await settle();
    expect(put).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("device");
  });

  it("compares answers, lists included", () => {
    expect(changedAnswers({ q1: ["a", "b"], q2: "x", q3: "" }, { q1: ["a", "b"], q2: "y" })).toEqual({ q2: "x" });
    expect(changedAnswers({ q1: [] }, { q1: ["a"] })).toEqual({ q1: [] });
  });
});
