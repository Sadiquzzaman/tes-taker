"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/design/ui";
import { useStorageItem } from "@/hooks/useBrowserStorage";

const BASE = process.env.NEXT_PUBLIC_BASE_URL;

type PlayState = "ready" | "playing" | "done";

const storageKey = (attemptId: string, partId: string) => `ielts-played:${attemptId}:${partId}`;

const writeState = (key: string, value: PlayState) => {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // Private windows may refuse storage; the recording still plays once on this page.
  }
};

/**
 * A Listening part's recording, as in the real test (IEL-04): played once, with no pause, rewind or
 * seeking; only the volume can change. The browser needs one click to start sound.
 */
const ListeningPlayer = ({ attemptId, part }: { attemptId: string; part: IeltsPaperPart }) => {
  const t = useTranslations("ieltsTake");
  const audio = useRef<HTMLAudioElement>(null);
  const key = storageKey(attemptId, part.id);
  const stored = useStorageItem("session", key);
  const [local, setState] = useState<PlayState | null>(null);
  // A recording that was playing when the page was left counts as played, as in the real test.
  const state: PlayState = local ?? (stored === "playing" || stored === "done" ? "done" : "ready");
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    if (audio.current) audio.current.volume = volume;
  }, [volume]);

  if (!part.audio_file_id) return <p className="text-body-sm text-ink-muted">{t("noRecording")}</p>;

  const play = async () => {
    if (!audio.current || state !== "ready") return;
    writeState(key, "playing");
    setState("playing");
    try {
      await audio.current.play();
    } catch {
      // Could not start (e.g. blocked): let the student try again.
      writeState(key, "ready");
      setState("ready");
    }
  };

  const finish = () => {
    writeState(key, "done");
    setState("done");
  };

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-card border border-border bg-canvas p-3">
      <audio
        ref={audio}
        src={`${BASE}/files/${part.audio_file_id}/content`}
        preload="auto"
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          if (el.duration) setProgress(Math.round((el.currentTime / el.duration) * 100));
        }}
        onEnded={finish}
        onPause={(e) => {
          // No pausing in the test: carry on unless it ended.
          if (state === "playing" && !e.currentTarget.ended) void e.currentTarget.play().catch(() => undefined);
        }}
      />
      {state === "ready" ? (
        <Button onClick={() => void play()}>{t("playPart", { no: part.part_no })}</Button>
      ) : (
        <span className="text-body-sm font-medium text-ink">{state === "playing" ? t("playing") : t("played")}</span>
      )}
      <progress className="h-2 flex-1" max={100} value={state === "done" ? 100 : progress} aria-label={t("recordingProgress")} />
      <label className="flex items-center gap-2 text-body-sm text-ink">
        {t("volume")}
        <input type="range" min={0} max={1} step={0.1} value={volume} onChange={(e) => setVolume(Number(e.target.value))} />
      </label>
    </div>
  );
};

export default ListeningPlayer;
