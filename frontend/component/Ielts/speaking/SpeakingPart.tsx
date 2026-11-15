"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { RichTextContent } from "@/component/RichTextEditor";
import { Button, Card, cn } from "@/design/ui";
import { useApiError } from "@/hooks/api/useApiError";
import { uploadMedia } from "@/utils/media/uploadMedia";
import useRecorder from "./useRecorder";

const BASE = process.env.NEXT_PUBLIC_BASE_URL;

/** Part 2: one minute to prepare, then up to two minutes to talk (IEL-07). */
export const PREPARE_SECONDS = 60;
export const TALK_SECONDS = 120;

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

/** A countdown that ticks while running and stops at 0. */
const useCountdown = () => {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (left === null || left <= 0) return;
    const id = setTimeout(() => setLeft((value) => (value === null ? null : value - 1)), 1000);
    return () => clearTimeout(id);
  }, [left]);
  return { left, start: (seconds: number) => setLeft(seconds) };
};

/**
 * One Speaking part (IEL-07): the questions or cue card; Part 2 has a 1-minute preparation timer
 * and a 2-minute talk timer; the part can be recorded in the browser and the recording kept.
 */
const SpeakingPart = ({
  part,
  recordingId,
  readOnly = false,
  onRecorded,
}: {
  part: IeltsPaperPart | { id: string; part_no: number; title: string | null; content: string | null };
  recordingId: string | null;
  readOnly?: boolean;
  onRecorded: (fileId: string | null) => Promise<void>;
}) => {
  const t = useTranslations("ieltsSpeaking");
  const { handleError } = useApiError();
  const prepare = useCountdown();
  const talk = useCountdown();
  const recorder = useRecorder();
  const [uploading, setUploading] = useState(false);

  const keep = async (file: File) => {
    setUploading(true);
    try {
      const uploaded = await uploadMedia("ielts", file);
      await onRecorded(uploaded.id);
    } catch (err) {
      handleError(err as AxiosError<ApiError>);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <section aria-label={t("partN", { no: part.part_no })} className="flex flex-col gap-4">
        <h2 className="text-title-sm font-semibold text-ink">{t("partN", { no: part.part_no })}</h2>
        <p className="text-body-sm text-ink-muted">{t(`partHint.${part.part_no}` as "partHint.1")}</p>
        {part.title ? <p className="font-medium text-ink">{part.title}</p> : null}
        <RichTextContent html={part.content ?? ""} />
        {part.part_no === 2 && !readOnly ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" variant="secondary" onClick={() => prepare.start(PREPARE_SECONDS)}>
              {t("startPreparation")}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => talk.start(TALK_SECONDS)}>
              {t("startTalking")}
            </Button>
            {prepare.left !== null ? (
              <span role="timer" aria-label={t("preparationTime")} className={cn("font-mono text-body font-semibold", prepare.left === 0 ? "text-danger" : "text-ink")}>
                {t("prepare")} {clock(prepare.left)}
              </span>
            ) : null}
            {talk.left !== null ? (
              <span role="timer" aria-label={t("talkTime")} className={cn("font-mono text-body font-semibold", talk.left === 0 ? "text-danger" : "text-ink")}>
                {t("talk")} {clock(talk.left)}
              </span>
            ) : null}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          {recordingId ? <audio controls preload="none" src={`${BASE}/files/${recordingId}/content`} aria-label={t("recordingOf", { no: part.part_no })} /> : <span className="text-body-sm text-ink-muted">{t("noRecording")}</span>}
          {!readOnly ? (
            recorder.state === "recording" ? (
              <Button size="sm" onClick={recorder.stop}>
                {t("stopRecording")}
              </Button>
            ) : (
              <Button size="sm" variant="secondary" loading={uploading} onClick={() => void recorder.start((file) => void keep(file))}>
                {recordingId ? t("recordAgain") : t("record")}
              </Button>
            )
          ) : null}
          {recorder.state === "unsupported" ? <span className="text-body-sm text-warning">{t("noMicrophoneSupport")}</span> : null}
          {recorder.state === "denied" ? <span className="text-body-sm text-warning">{t("microphoneDenied")}</span> : null}
        </div>
      </section>
    </Card>
  );
};

export default SpeakingPart;
