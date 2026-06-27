"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Speech → Text only. This hook isolates the browser Speech Recognition API so it can be
 * reused for future voice features (question creation, explanations, voice notes, etc.).
 *
 * It intentionally does NOT do any AI parsing, option extraction or answer detection.
 */

export type SpeechRecognitionStatus = "idle" | "listening" | "processing" | "completed" | "error";

/** Languages we plan to support. Default is en-US; the consumer picks via the `lang` option. */
export type SpeechRecognitionLanguage = "en-US" | "en-GB" | "bn-BD";

// --- Minimal local typings (kept here so the feature stays self-contained) ---
interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResultLike {
  readonly length: number;
  readonly isFinal: boolean;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionResultListLike {
  readonly length: number;
  [index: number]: SpeechRecognitionResultLike;
}

interface SpeechRecognitionEventLike extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultListLike;
}

interface SpeechRecognitionErrorEventLike extends Event {
  readonly error: string;
  readonly message?: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onstart: ((event: Event) => void) | null;
  onend: ((event: Event) => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

const getSpeechRecognitionConstructor = (): SpeechRecognitionConstructor | undefined => {
  if (typeof window === "undefined") {
    return undefined;
  }
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};

const resolveErrorMessage = (errorCode: string): string => {
  switch (errorCode) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone access is required for speech input.";
    case "no-speech":
      return "No speech detected. Please try again.";
    case "audio-capture":
      return "No microphone was found. Please connect a microphone and try again.";
    case "network":
      return "Network error during speech recognition. Please try again.";
    default:
      return "Speech recognition failed. Please try again.";
  }
};

export interface UseSpeechRecognitionOptions {
  lang?: SpeechRecognitionLanguage | string;
  continuous?: boolean;
  interimResults?: boolean;
  /** Called once per finalized chunk of speech. */
  onResult?: (finalTranscript: string) => void;
  /** Called once when recognition ends successfully, with the full session transcript. */
  onEnd?: (finalTranscript: string) => void;
  /** Called with a user-friendly message whenever recognition fails. */
  onError?: (message: string) => void;
}

export interface UseSpeechRecognitionReturn {
  isSupported: boolean;
  isListening: boolean;
  status: SpeechRecognitionStatus;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
}

const useSpeechRecognition = ({
  lang = "en-US",
  continuous = false,
  interimResults = true,
  onResult,
  onEnd,
  onError,
}: UseSpeechRecognitionOptions = {}): UseSpeechRecognitionReturn => {
  const [isSupported, setIsSupported] = useState(false);
  const [status, setStatus] = useState<SpeechRecognitionStatus>("idle");
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const manualStopRef = useRef(false);
  const gotFinalResultRef = useRef(false);
  const hadErrorRef = useRef(false);
  // Accumulates finalized text across the whole session (handles continuous mode + pauses).
  const transcriptRef = useRef("");
  // Guards against double-starts when a user clicks the button rapidly.
  const activeRef = useRef(false);

  // Keep the latest callbacks without re-creating the recognition instance.
  const onResultRef = useRef(onResult);
  const onEndRef = useRef(onEnd);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onResultRef.current = onResult;
    onEndRef.current = onEnd;
    onErrorRef.current = onError;
  }, [onResult, onEnd, onError]);

  useEffect(() => {
    setIsSupported(Boolean(getSpeechRecognitionConstructor()));
  }, []);

  const emitError = useCallback((message: string) => {
    hadErrorRef.current = true;
    setError(message);
    setStatus("error");
    setInterimTranscript("");
    activeRef.current = false;
    onErrorRef.current?.(message);
  }, []);

  const stopListening = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition || !activeRef.current) {
      return;
    }
    manualStopRef.current = true;
    setStatus("processing");
    try {
      recognition.stop();
    } catch {
      // stop() can throw if already stopped — safe to ignore.
    }
  }, []);

  const startListening = useCallback(() => {
    const SpeechRecognitionImpl = getSpeechRecognitionConstructor();

    if (!SpeechRecognitionImpl) {
      emitError("Speech recognition is not supported in your browser.");
      return;
    }

    // Race-condition guard: ignore repeated clicks while already active.
    if (activeRef.current) {
      return;
    }

    const recognition = new SpeechRecognitionImpl();
    recognition.lang = lang;
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.maxAlternatives = 1;

    manualStopRef.current = false;
    gotFinalResultRef.current = false;
    hadErrorRef.current = false;
    transcriptRef.current = "";
    activeRef.current = true;
    setError(null);
    setTranscript("");
    setInterimTranscript("");

    recognition.onstart = () => {
      setStatus("listening");
    };

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) {
          const finalText = text.trim();
          if (finalText) {
            gotFinalResultRef.current = true;
            transcriptRef.current = transcriptRef.current ? `${transcriptRef.current} ${finalText}` : finalText;
            setTranscript(transcriptRef.current);
            onResultRef.current?.(finalText);
          }
        } else {
          interim += text;
        }
      }
      setInterimTranscript(interim);
    };

    recognition.onerror = (event) => {
      // Manual stop surfaces as "aborted"; that is expected, not an error.
      if (event.error === "aborted" && manualStopRef.current) {
        return;
      }
      emitError(resolveErrorMessage(event.error));
    };

    recognition.onend = () => {
      activeRef.current = false;
      setInterimTranscript("");
      recognitionRef.current = null;

      if (hadErrorRef.current) {
        return;
      }

      if (!gotFinalResultRef.current) {
        const message = "No speech detected. Please try again.";
        hadErrorRef.current = true;
        setError(message);
        setStatus("error");
        onErrorRef.current?.(message);
        return;
      }

      setStatus("completed");
      const finalText = transcriptRef.current.trim();
      if (finalText) {
        onEndRef.current?.(finalText);
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      activeRef.current = false;
      recognitionRef.current = null;
      emitError("Could not start speech recognition. Please try again.");
    }
  }, [lang, continuous, interimResults, emitError]);

  const resetTranscript = useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
  }, []);

  // Clean up any in-flight recognition on unmount.
  useEffect(() => {
    return () => {
      const recognition = recognitionRef.current;
      if (recognition) {
        manualStopRef.current = true;
        try {
          recognition.abort();
        } catch {
          // ignore
        }
        recognitionRef.current = null;
        activeRef.current = false;
      }
    };
  }, []);

  return {
    isSupported,
    isListening: status === "listening",
    status,
    transcript,
    interimTranscript,
    error,
    startListening,
    stopListening,
    resetTranscript,
  };
};

export default useSpeechRecognition;
