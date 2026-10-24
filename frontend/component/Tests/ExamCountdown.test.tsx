import { act, cleanup, screen } from "@testing-library/react";
import { renderWithIntl } from "@/i18n/test-utils";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ExamCountdown from "./ExamCountdown";

const renderCountdown = (props: Partial<ExamCountdownProps> = {}, disabledSubmit = false) => {
  const submitButtonRef = createRef<HTMLButtonElement>();
  const onStart = vi.fn();
  const onTimeUp = vi.fn();
  const view = renderWithIntl(
    <>
      <button ref={submitButtonRef} disabled={disabledSubmit}>
        Submit
      </button>
      <ExamCountdown submitButtonRef={submitButtonRef} onStart={onStart} onTimeUp={onTimeUp} {...props} />
    </>,
  );
  return { ...view, submitButtonRef, onStart, onTimeUp };
};

const tick = (seconds: number) =>
  act(() => {
    vi.advanceTimersByTime(seconds * 1000);
  });

describe("ExamCountdown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("shows the time with Bangla digits on a Bangla page", () => {
    renderWithIntl(<ExamCountdown submitButtonRef={createRef<HTMLButtonElement>()} remainingSeconds={65} />, "bn");

    expect(screen.getByText("০১ মিনিট ০৫ সেকেন্ড")).toBeTruthy();
  });

  it("counts down every second instead of staying at the start value", () => {
    renderCountdown({ remainingSeconds: 5 });
    expect(screen.getByText("00 min 05 sec")).toBeTruthy();

    tick(2);

    expect(screen.getByText("00 min 03 sec")).toBeTruthy();
  });

  it("calls onStart once and onTimeUp once when time runs out", () => {
    const { onStart, onTimeUp } = renderCountdown({ remainingSeconds: 3 });

    tick(3);
    tick(5);

    expect(screen.getByText("00 min 00 sec")).toBeTruthy();
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onTimeUp).toHaveBeenCalledTimes(1);
  });

  it("does not auto-submit while the submit button is disabled", () => {
    const { onTimeUp } = renderCountdown({ remainingSeconds: 2 }, true);

    tick(3);

    expect(onTimeUp).not.toHaveBeenCalled();
  });

  it("submits immediately, without onStart, when no time is left", () => {
    const { onStart, onTimeUp } = renderCountdown({ remainingSeconds: 0 });

    expect(onTimeUp).toHaveBeenCalledTimes(1);
    expect(onStart).not.toHaveBeenCalled();
  });

  it("restarts from the new server time without calling onStart again", () => {
    const { rerender, submitButtonRef, onStart, onTimeUp } = renderCountdown({ remainingSeconds: 10 });
    tick(2);

    rerender(
      <>
        <button ref={submitButtonRef}>Submit</button>
        <ExamCountdown submitButtonRef={submitButtonRef} onStart={onStart} onTimeUp={onTimeUp} remainingSeconds={3} />
      </>,
    );
    expect(screen.getByText("00 min 03 sec")).toBeTruthy();

    tick(3);

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onTimeUp).toHaveBeenCalledTimes(1);
  });

  it("uses the exam duration in minutes when there is no server remaining time", () => {
    renderCountdown({ durationMinutes: 1 });

    expect(screen.getByText("01 min 00 sec")).toBeTruthy();
  });
});
