"use client";

import useFormat from "@/i18n/useFormat";
import { useTranslations } from "next-intl";
import { useEffect, useEffectEvent, useRef, useState } from "react";

export default function ExamCountdown({
  durationMinutes,
  remainingSeconds,
  submitButtonRef,
  onStart,
  onTimeUp,
}: ExamCountdownProps) {
  const t = useTranslations("exam");
  const format = useFormat();
  const initialSeconds =
    typeof remainingSeconds === "number"
      ? remainingSeconds
      : typeof durationMinutes === "number"
        ? durationMinutes * 60
        : null;

  const [timeLeft, setTimeLeft] = useState<number | null>(initialSeconds);
  // Start again from the new value whenever the exam duration or server remaining time changes.
  const [timerSource, setTimerSource] = useState({ durationMinutes, remainingSeconds });
  if (timerSource.durationMinutes !== durationMinutes || timerSource.remainingSeconds !== remainingSeconds) {
    setTimerSource({ durationMinutes, remainingSeconds });
    setTimeLeft(initialSeconds);
  }

  const hasSubmittedRef = useRef(false);
  const hasStartedRef = useRef(false);
  const intervalRef = useRef<number | null>(null);
  const handleStart = useEffectEvent(() => {
    onStart?.();
  });
  const handleTimeUp = useEffectEvent(() => {
    if (hasSubmittedRef.current) {
      return;
    }
    hasSubmittedRef.current = true;
    onTimeUp?.();
  });

  // Run the countdown. It restarts only when the starting value changes, not on every render.
  useEffect(() => {
    hasSubmittedRef.current = false;

    if (initialSeconds === null) {
      hasStartedRef.current = false;
      return;
    }

    if (initialSeconds <= 0) {
      handleTimeUp();
      return;
    }

    if (!hasStartedRef.current) {
      hasStartedRef.current = true;
      handleStart();
    }

    const interval = window.setInterval(() => {
      setTimeLeft((previousTimeLeft) =>
        previousTimeLeft === null || previousTimeLeft <= 0 ? 0 : previousTimeLeft - 1,
      );
    }, 1000);
    intervalRef.current = interval;

    return () => {
      window.clearInterval(interval);
      intervalRef.current = null;
    };
  }, [durationMinutes, initialSeconds, remainingSeconds]);

  // When the countdown reaches zero, stop it and submit (unless a submit is already in progress).
  const isTimeUp = timeLeft === 0;
  useEffect(() => {
    if (!isTimeUp) {
      return;
    }

    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!submitButtonRef.current?.disabled) {
      handleTimeUp();
    }
  }, [isTimeUp, submitButtonRef]);

  const formatTime = (seconds: number) =>
    t("countdown", { minutes: format.twoDigits(Math.floor(seconds / 60)), seconds: format.twoDigits(seconds % 60) });

  return (
    <p className="font-[500] text-[16px] leading-[16px] text-[#232A25]">
      {timeLeft !== null ? formatTime(timeLeft) : "--"}
    </p>
  );
}
