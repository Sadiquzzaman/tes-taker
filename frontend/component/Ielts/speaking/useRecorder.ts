"use client";

import { useCallback, useRef, useState } from "react";

export type RecorderState = "idle" | "recording" | "unsupported" | "denied";

/**
 * Records from the microphone in the browser (MediaRecorder, audio/webm) and hands back a file to
 * upload. The browser asks for the microphone the first time.
 */
const useRecorder = () => {
  const [state, setState] = useState<RecorderState>("idle");
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const finished = useRef<((file: File) => void) | null>(null);

  const start = useCallback(async (onFile: (file: File) => void) => {
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setState("unsupported");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const media = new MediaRecorder(stream);
      chunks.current = [];
      finished.current = onFile;
      media.ondataavailable = (e) => {
        if (e.data.size) chunks.current.push(e.data);
      };
      media.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunks.current, { type: "audio/webm" });
        finished.current?.(new File([blob], `speaking-${Date.now()}.webm`, { type: "audio/webm" }));
        setState("idle");
      };
      recorder.current = media;
      media.start();
      setState("recording");
    } catch {
      setState("denied");
    }
  }, []);

  const stop = useCallback(() => {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }, []);

  return { state, start, stop };
};

export default useRecorder;
