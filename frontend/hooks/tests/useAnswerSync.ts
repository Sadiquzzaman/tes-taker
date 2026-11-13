"use client";

import { AxiosError } from "axios";
import { useCallback, useEffect, useRef, useState } from "react";
import axiosReq from "@/lib/axios";

/** Where the student's latest answers are (PRO-09): only on this device, on the way, or on the server. */
export type AnswerSaveStatus = "idle" | "device" | "saving" | "server";

/** Wait after the last change before sending; retries back off up to `MAX_RETRY_MS`. */
export const SYNC_DELAY_MS = 3_000;
export const FIRST_RETRY_MS = 5_000;
export const MAX_RETRY_MS = 30_000;

const isEmpty = (value: ExamAnswerValue | undefined) => value === undefined || (Array.isArray(value) ? value.length === 0 : value.trim() === "");
const same = (a: ExamAnswerValue | undefined, b: ExamAnswerValue | undefined) => JSON.stringify(a ?? "") === JSON.stringify(b ?? "");

/** The answers that changed since the server last confirmed them (an emptied answer is sent empty, to clear it). */
export const changedAnswers = (current: ExamAnswerState, onServer: ExamAnswerState): ExamAnswerState => {
  const changed: ExamAnswerState = {};
  for (const [questionId, value] of Object.entries(current)) {
    if (same(value, onServer[questionId])) continue;
    if (isEmpty(value) && onServer[questionId] === undefined) continue;
    changed[questionId] = value;
  }
  return changed;
};

/**
 * Low-bandwidth mode (P8-05, PRO-09): answers are kept on the device (examAnswerStorage) and sent
 * to the server a few seconds after a change, only the questions that changed. When the
 * connection drops, sending is retried with a growing pause and at once when the browser is back
 * online. The server refuses saves after the deadline + 60 seconds (403); then sending stops, and
 * the server finalises the attempt with what it has.
 */
const useAnswerSync = ({ examId, answers, enabled }: { examId: string | null | undefined; answers: ExamAnswerState; enabled: boolean }) => {
  // What the server has confirmed; the ref mirrors it for timers.
  const [onServer, setOnServer] = useState<ExamAnswerState>({});
  const [sending, setSending] = useState(false);
  const onServerRef = useRef<ExamAnswerState>({});
  const latest = useRef(answers);
  const inFlight = useRef(false);
  const stopped = useRef(false);
  const timer = useRef<number | null>(null);
  const retryDelay = useRef(FIRST_RETRY_MS);
  // The latest `send`, for timers set by `send` itself.
  const sendLater = useRef<() => void>(() => undefined);

  const schedule = useCallback((delay: number) => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      sendLater.current();
    }, delay);
  }, []);

  const send = useCallback(async () => {
    if (!examId || inFlight.current || stopped.current) return;
    const changed = changedAnswers(latest.current, onServerRef.current);
    if (Object.keys(changed).length === 0) return;
    inFlight.current = true;
    setSending(true);
    try {
      await axiosReq.put(`${process.env.NEXT_PUBLIC_BASE_URL}/student/exams/${examId}/answersheet`, { answersheet: changed });
      onServerRef.current = { ...onServerRef.current, ...changed };
      setOnServer(onServerRef.current);
      retryDelay.current = FIRST_RETRY_MS;
      // Something changed while sending: send that too.
      if (Object.keys(changedAnswers(latest.current, onServerRef.current)).length > 0) schedule(SYNC_DELAY_MS);
    } catch (error) {
      const code = (error as AxiosError).response?.status;
      // Time is up or the attempt is closed: the server keeps what it has.
      if (code === 400 || code === 403 || code === 404) {
        stopped.current = true;
      } else {
        schedule(retryDelay.current);
        retryDelay.current = Math.min(retryDelay.current * 2, MAX_RETRY_MS);
      }
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  }, [examId, schedule]);

  useEffect(() => {
    sendLater.current = () => void send();
  }, [send]);

  useEffect(() => {
    latest.current = answers;
    if (!enabled || !examId || stopped.current || inFlight.current) return;
    // Kept on the device already (examAnswerStorage); send once the student pauses.
    if (Object.keys(changedAnswers(answers, onServerRef.current)).length > 0) schedule(SYNC_DELAY_MS);
  }, [answers, enabled, examId, schedule]);

  useEffect(() => {
    if (!enabled) return;
    const online = () => {
      retryDelay.current = FIRST_RETRY_MS;
      void send();
    };
    window.addEventListener("online", online);
    return () => {
      window.removeEventListener("online", online);
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, [enabled, send]);

  const pending = enabled && Object.keys(changedAnswers(answers, onServer)).length > 0;
  const status: AnswerSaveStatus = sending ? "saving" : pending ? "device" : Object.keys(onServer).length > 0 ? "server" : "idle";
  return { status };
};

export default useAnswerSync;
