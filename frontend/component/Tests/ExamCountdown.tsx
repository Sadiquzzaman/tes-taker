"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";

export default function ExamCountdown({ durationMinutes, submitButtonRef, onStart, onTimeUp }: ExamCountdownProps) {
  const [timeLeft, setTimeLeft] = useState<number | null>(
    typeof durationMinutes === "number" ? durationMinutes * 60 : null,
  );
  const hasSubmittedRef = useRef(false);
  const hasStartedRef = useRef(false);
  const handleStart = useEffectEvent(() => {
    onStart?.();
  });
  const handleTimeUp = useEffectEvent(() => {
    onTimeUp?.();
  });

  useEffect(() => {
    if (typeof durationMinutes !== "number") {
      hasSubmittedRef.current = false;
      hasStartedRef.current = false;
      return;
    }

    hasSubmittedRef.current = false;

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
  }, [durationMinutes, handleStart, handleTimeUp, submitButtonRef]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    return `${String(minutes).padStart(2, "0")} min ${String(remainingSeconds).padStart(2, "0")} sec`;
  };

  return (
    <p className="font-[500] text-[16px] leading-[16px] text-[#232A25]">
      {timeLeft !== null ? formatTime(timeLeft) : "--"}
    </p>
  );
}
