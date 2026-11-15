"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useState } from "react";
import useApiData from "@/component/Homework/useApiData";
import { useToast } from "@/component/Toast/ToastContext";
import { Button, Card, ErrorState, Input, PageHeader, Skeleton } from "@/design/ui";
import { useApiError } from "@/hooks/api/useApiError";
import axiosReq from "@/lib/axios";

type Thresholds = SimilarityReportData["thresholds"];

/** Plagiarism thresholds (P10-09, PLG-03) for owners and admins: High and Medium similarity, and the fewest words checked. */
const PlagiarismSettings = () => {
  const t = useTranslations("plagiarism");
  const { triggerToast } = useToast();
  const { handleError } = useApiError();
  const { data, failed, reload, setData } = useApiData<Thresholds>("/integrity/settings");
  const [form, setForm] = useState<Record<keyof Thresholds, string> | null>(null);
  const [busy, setBusy] = useState(false);

  if (failed !== null) return <ErrorState title={failed === 403 ? t("notAvailable") : t("loadFailed")} onRetry={reload} />;
  if (!data) {
    return (
      <Card aria-busy="true">
        <Skeleton lines={3} />
      </Card>
    );
  }
  const values = form ?? { high: String(data.high), medium: String(data.medium), min_words: String(data.min_words) };
  const save = async () => {
    setBusy(true);
    try {
      const res = await axiosReq.put<{ payload: Thresholds }>(`${process.env.NEXT_PUBLIC_BASE_URL}/integrity/settings`, { high: Number(values.high), medium: Number(values.medium), min_words: Number(values.min_words) });
      setData(res.data.payload);
      setForm(null);
      triggerToast({ title: t("settingsSaved"), type: "success" });
    } catch (err) {
      handleError(err as AxiosError<ApiError>);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader title={t("settingsTitle")} description={t("settingsDescription")} />
      <Card>
        <div className="grid gap-4 sm:grid-cols-3">
          <Input label={t("highFrom")} type="number" min={1} max={100} value={values.high} onChange={(e) => setForm({ ...values, high: e.target.value })} />
          <Input label={t("mediumFrom")} type="number" min={1} max={99} value={values.medium} onChange={(e) => setForm({ ...values, medium: e.target.value })} />
          <Input label={t("minWords")} type="number" min={0} max={1000} value={values.min_words} onChange={(e) => setForm({ ...values, min_words: e.target.value })} />
        </div>
        <div className="mt-4">
          <Button loading={busy} onClick={() => void save()}>
            {t("save")}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default PlagiarismSettings;
