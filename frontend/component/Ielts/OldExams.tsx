"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import useApiData from "@/component/Homework/useApiData";
import { Button, Card, Link, Modal } from "@/design/ui";
import { useApiError } from "@/hooks/api/useApiError";
import useFormat from "@/i18n/useFormat";
import axiosReq from "@/lib/axios";

type OldExam = { id: string; title: string; created_at: string; converted_test_id: string | null };
type Conversion = { test_id: string; converted: number; skipped: { question_id: string; reason: string }[] };

/**
 * IELTS exams made in the academic builder (P10-08): copy each into the new format once; the copy
 * is a draft to check, and questions that did not fit are listed. Hidden when there are none.
 */
const OldExams = () => {
  const t = useTranslations("ieltsConvert");
  const format = useFormat();
  const router = useRouter();
  const { handleError } = useApiError();
  const { data: exams, reload } = useApiData<OldExam[]>("/ielts/old-exams");
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<Conversion | null>(null);

  if (!exams?.length) return null;

  const convert = async (exam: OldExam) => {
    setBusy(exam.id);
    try {
      const res = await axiosReq.post<{ payload: Conversion }>(`${process.env.NEXT_PUBLIC_BASE_URL}/ielts/old-exams/${exam.id}/convert`);
      setDone(res.data.payload);
      reload();
    } catch (err) {
      handleError(err as AxiosError<ApiError>);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card title={t("title")} description={t("description")}>
      <ul className="flex flex-col divide-y divide-border">
        {exams.map((exam) => (
          <li key={exam.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span className="text-body-sm text-ink">
              <span className="font-medium">{exam.title}</span>
              <span className="ms-2 text-ink-muted">{format.date(exam.created_at, { dateStyle: "medium" })}</span>
            </span>
            {exam.converted_test_id ? (
              <Link href={`/ielts/tests/${exam.converted_test_id}`}>{t("openCopy")}</Link>
            ) : (
              <Button size="sm" variant="secondary" loading={busy === exam.id} onClick={() => void convert(exam)} aria-label={t("convertFor", { title: exam.title })}>
                {t("convert")}
              </Button>
            )}
          </li>
        ))}
      </ul>
      {done ? (
        <Modal
          open
          onClose={() => setDone(null)}
          title={t("doneTitle")}
          description={t("doneDescription", { count: done.converted })}
          footer={
            <>
              <Button variant="ghost" onClick={() => setDone(null)}>
                {t("close")}
              </Button>
              <Button onClick={() => router.push(`/ielts/tests/${done.test_id}`)}>{t("openCopy")}</Button>
            </>
          }
        >
          {done.skipped.length ? (
            <div className="flex flex-col gap-2">
              <p className="text-body-sm text-ink">{t("skipped", { count: done.skipped.length })}</p>
              <ul className="list-disc ps-5 text-body-sm text-ink-muted" aria-label={t("skippedList")}>
                {done.skipped.map((s) => (
                  <li key={s.question_id}>{s.reason}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-body-sm text-ink">{t("nothingSkipped")}</p>
          )}
        </Modal>
      ) : null}
    </Card>
  );
};

export default OldExams;
