"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useState } from "react";
import useApiData from "@/component/Homework/useApiData";
import { useToast } from "@/component/Toast/ToastContext";
import { Button, Card, ErrorState, PageHeader, Select, Skeleton, StatTile, Textarea } from "@/design/ui";
import { useApiError } from "@/hooks/api/useApiError";
import useFormat from "@/i18n/useFormat";
import axiosReq from "@/lib/axios";
import { BANDS } from "../bands";
import SpeakingPart from "./SpeakingPart";

const BASE = process.env.NEXT_PUBLIC_BASE_URL;

/** Fluency and Coherence, Lexical Resource, Grammatical Range and Accuracy, Pronunciation. */
const CRITERIA = ["FC", "LR", "GRA", "P"];

const roundBand = (value: number) => Math.round(value * 2 + 1e-9) / 2;

/**
 * The examiner screen (P10-06, IEL-07): Parts 1–3 with the Part 2 preparation and talk timers,
 * recording in the browser for a live session (a student's practice shows their recordings), and
 * bands for the four criteria with notes. Saving the marks ends a live session.
 */
const Examiner = ({ attemptId }: { attemptId: string }) => {
  const t = useTranslations("ieltsSpeaking");
  const tk = useTranslations("ieltsTake");
  const format = useFormat();
  const { triggerToast } = useToast();
  const { handleError } = useApiError();
  const { data: view, failed, reload, setData } = useApiData<IeltsMarkingView>(`/ielts/marking/${attemptId}`);
  const [given, setGiven] = useState<Record<string, string> | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (failed !== null) return <ErrorState title={failed === 409 ? t("notHandedIn") : t("loadFailed")} onRetry={reload} />;
  if (!view) {
    return (
      <Card aria-busy="true">
        <Skeleton lines={8} />
      </Card>
    );
  }
  const live = view.mode === "LIVE";
  const criteria = given ?? Object.fromEntries(Object.entries(view.speaking ?? {}).map(([k, v]) => [k, String(v)]));
  const feedback = notes ?? view.feedback ?? "";
  const band = (value: number) => format.number(value, { minimumFractionDigits: 1 });
  const ready = CRITERIA.every((k) => criteria[k] !== undefined && criteria[k] !== "");
  const preview = ready ? roundBand(CRITERIA.reduce((sum, k) => sum + Number(criteria[k]), 0) / CRITERIA.length) : null;
  const options = BANDS.map((b) => ({ value: String(b), label: band(b) }));

  const save = async () => {
    setBusy(true);
    try {
      const res = await axiosReq.put<{ payload: IeltsMarkingView }>(`${BASE}/ielts/marking/${attemptId}/speaking`, {
        criteria: Object.fromEntries(CRITERIA.map((k) => [k, Number(criteria[k])])),
        feedback: feedback || undefined,
      });
      setData(res.data.payload);
      triggerToast({ title: t("saved"), type: "success" });
    } catch (err) {
      handleError(err as AxiosError<ApiError>);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader title={t("examinerTitle", { name: view.student.full_name })} description={`${view.test.title} · ${view.batch} · ${live ? t("live") : t("practice")}`} />
      {view.band !== null ? <StatTile label={t("speakingBand")} value={band(view.band)} /> : null}
      {view.tasks.map((task) => (
        <SpeakingPart
          key={task.part_id}
          part={{ id: task.part_id, part_no: task.part_no, title: task.title, content: task.content }}
          recordingId={task.recording_file_id ?? null}
          readOnly={!live || view.status === "MARKED"}
          onRecorded={async (fileId) => {
            const res = await axiosReq.put<{ payload: IeltsMarkingView }>(`${BASE}/ielts/marking/${attemptId}/recordings`, { part_id: task.part_id, file_id: fileId });
            setData(res.data.payload);
          }}
        />
      ))}
      <Card>
        <section aria-label={t("marks")} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {CRITERIA.map((key) => (
              <Select key={key} label={tk(`criteria.${key}` as "criteria.CC")} placeholder="—" value={criteria[key] ?? ""} onChange={(e) => setGiven({ ...criteria, [key]: e.target.value })} options={options} />
            ))}
          </div>
          <p className="text-body-sm font-medium text-ink">{preview === null ? t("bandPending") : t("bandPreview", { band: band(preview) })}</p>
          <Textarea label={t("notes")} value={feedback} onChange={(e) => setNotes(e.target.value)} rows={4} />
          <div>
            <Button loading={busy} disabled={!ready} onClick={() => void save()}>
              {live && view.status !== "MARKED" ? t("saveAndEnd") : t("saveMarks")}
            </Button>
          </div>
        </section>
      </Card>
    </div>
  );
};

export default Examiner;
