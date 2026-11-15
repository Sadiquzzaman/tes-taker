"use client";

import { AxiosError } from "axios";
import { useCallback, useEffect, useRef, useState } from "react";
import axiosReq from "@/lib/axios";

export type IeltsSaveStatus = "idle" | "saving" | "saved" | "error";

const SAVE_AFTER_MS = 1500;

/**
 * One IELTS attempt (P10-04, IEL-04, IEL-05): the paper, the student's answers saved shortly after
 * each change, a timer from the server's clock (the device's may be wrong), and hand-in, which
 * also happens by itself when the time runs out.
 */
const useIeltsAttempt = (attemptId: string) => {
  const base = process.env.NEXT_PUBLIC_BASE_URL;
  const [view, setView] = useState<IeltsAttemptView | null>(null);
  const [failed, setFailed] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saveStatus, setSaveStatus] = useState<IeltsSaveStatus>("idle");
  const [remaining, setRemaining] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const answersRef = useRef<Record<string, string>>({});
  const dirty = useRef<Set<string>>(new Set());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const offset = useRef(0);
  const handingIn = useRef(false);

  const take = useCallback((next: IeltsAttemptView) => {
    offset.current = Date.parse(next.attempt.now) - Date.now();
    answersRef.current = { ...next.answers };
    setAnswers(answersRef.current);
    setView(next);
  }, []);

  const load = useCallback(() => {
    setFailed(null);
    axiosReq
      .get<{ payload: IeltsAttemptView }>(`${base}/ielts/my/attempts/${attemptId}`)
      .then((res) => take(res.data.payload))
      .catch((error: AxiosError) => setFailed(error.response?.status ?? 0));
  }, [attemptId, base, take]);

  useEffect(() => load(), [load]);

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    if (!dirty.current.size || handingIn.current) return;
    const ids = [...dirty.current];
    dirty.current.clear();
    setSaveStatus("saving");
    try {
      await axiosReq.put(`${base}/ielts/my/attempts/${attemptId}/answers`, { answers: ids.map((id) => ({ question_id: id, answer: answersRef.current[id] ?? null })) });
      setSaveStatus(dirty.current.size ? "saving" : "saved");
    } catch (error) {
      if ((error as AxiosError).response?.status === 409) {
        load();
        return;
      }
      ids.forEach((id) => dirty.current.add(id));
      setSaveStatus("error");
    }
  }, [attemptId, base, load]);

  const setAnswer = useCallback(
    (questionId: string, value: string) => {
      answersRef.current = { ...answersRef.current, [questionId]: value };
      setAnswers(answersRef.current);
      dirty.current.add(questionId);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), SAVE_AFTER_MS);
    },
    [flush],
  );

  /** Hands in with every answer (so nothing waits on a pending save). */
  const submit = useCallback(async () => {
    if (handingIn.current) return;
    handingIn.current = true;
    if (timer.current) clearTimeout(timer.current);
    setSubmitting(true);
    try {
      const all = Object.entries(answersRef.current).map(([question_id, answer]) => ({ question_id, answer: answer || null }));
      const res = await axiosReq.post<{ payload: IeltsAttemptView }>(`${base}/ielts/my/attempts/${attemptId}/submit`, { answers: all });
      dirty.current.clear();
      take(res.data.payload);
    } catch {
      handingIn.current = false;
      load();
    } finally {
      setSubmitting(false);
    }
  }, [attemptId, base, load, take]);

  const inProgress = view?.attempt.status === "IN_PROGRESS";
  const deadline = view?.attempt.deadline;
  useEffect(() => {
    if (!inProgress || !deadline) return;
    const tick = () => {
      const left = Math.max(0, Math.round((Date.parse(deadline) - (Date.now() + offset.current)) / 1000));
      setRemaining(left);
      if (left === 0) void submit();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [inProgress, deadline, submit]);

  useEffect(() => {
    const save = () => void flush();
    window.addEventListener("online", save);
    return () => window.removeEventListener("online", save);
  }, [flush]);

  return { view, failed, reload: load, answers, setAnswer, saveStatus, remaining, submit, submitting };
};

export default useIeltsAttempt;
