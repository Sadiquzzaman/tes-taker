"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";

export default function ExamCountdown({
  durationMinutes,
  remainingSeconds,
  submitButtonRef,
  onStart,
  onTimeUp,
}: ExamCountdownProps) {
  const initialSeconds =
    typeof remainingSeconds === "number"
      ? remainingSeconds
      : typeof durationMinutes === "number"
        ? durationMinutes * 60
        : null;

  const [timeLeft, setTimeLeft] = useState<number | null>(initialSeconds);
  const hasSubmittedRef = useRef(false);
  const hasStartedRef = useRef(false);
  const handleStart = useEffectEvent(() => {
    onStart?.();
  });
  const handleTimeUp = useEffectEvent(() => {
    onTimeUp?.();
  });

  useEffect(() => {
    if (initialSeconds === null) {
      hasSubmittedRef.current = false;
      hasStartedRef.current = false;
      setTimeLeft(null);
      return;
    }

    hasSubmittedRef.current = false;
    setTimeLeft(initialSeconds);

    if (initialSeconds <= 0) {
      if (!hasSubmittedRef.current) {
        hasSubmittedRef.current = true;
        handleTimeUp();
      }
      return;
    }

    if (!hasStartedRef.current) {
      hasStartedRef.current = true;
      handleStart();
    }

    const interval = window.setInterval(() => {
      setTimeLeft((previousTimeLeft) => {
        if (previousTimeLeft === null || previousTimeLeft <= 0) {
          window.clearInterval(interval);
          return 0;
        }

        if (previousTimeLeft === 1) {
          window.clearInterval(interval);

          if (!hasSubmittedRef.current && !submitButtonRef.current?.disabled) {
            hasSubmittedRef.current = true;
            handleTimeUp();
          }

          return 0;
        }

        return previousTimeLeft - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [durationMinutes, handleStart, handleTimeUp, initialSeconds, remainingSeconds, submitButtonRef]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remaining = seconds % 60;

    return `${String(minutes).padStart(2, "0")} min ${String(remaining).padStart(2, "0")} sec`;
  };

  return (
    <p className="font-[500] text-[16px] leading-[16px] text-[#232A25]">
      {timeLeft !== null ? formatTime(timeLeft) : "--"}
    </p>
  );
}
