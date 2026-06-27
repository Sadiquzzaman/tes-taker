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
  // Guards against double-starts when a user clicks the button rapidly.
  const activeRef = useRef(false);

  // Keep the latest callbacks without re-creating the recognition instance.
  const onResultRef = useRef(onResult);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onResultRef.current = onResult;
    onErrorRef.current = onError;
  }, [onResult, onError]);

  useEffect(() => {
    setIsSupported(Boolean(getSpeechRecognitionConstructor()));
  }, []);

  const emitError = useCallback((message: string) => {
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
    activeRef.current = true;
    setError(null);
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
            setTranscript((previous) => (previous ? `${previous} ${finalText}` : finalText));
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

      setStatus((current) => {
        if (current === "error") {
          return current;
        }
        if (!gotFinalResultRef.current && !manualStopRef.current) {
          const message = "No speech detected. Please try again.";
          setError(message);
          onErrorRef.current?.(message);
          return "error";
        }
        return "completed";
      });
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
