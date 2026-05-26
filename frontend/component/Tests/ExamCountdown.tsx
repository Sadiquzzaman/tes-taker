"use client";

import { useEffect, useRef, useState } from "react";

export default function ExamCountdown({ durationMinutes, submitButtonRef, onTimeUp }: ExamCountdownProps) {
  const [timeLeft, setTimeLeft] = useState<number | null>(
    typeof durationMinutes === "number" ? durationMinutes * 60 : null,
  );
  const hasSubmittedRef = useRef(false);

  useEffect(() => {
    if (typeof durationMinutes !== "number") {
      hasSubmittedRef.current = false;
      return;
    }

    hasSubmittedRef.current = false;

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
            onTimeUp?.();
          }

          return 0;
        }

        return previousTimeLeft - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [durationMinutes, onTimeUp, submitButtonRef]);

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
