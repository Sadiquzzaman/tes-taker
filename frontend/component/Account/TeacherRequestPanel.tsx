"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/component/Toast/ToastContext";
import { Button, Card, Skeleton, StatusPill } from "@/design/ui";
import { useApiError } from "@/hooks/api/useApiError";
import useFormat from "@/i18n/useFormat";
import axiosReq from "@/lib/axios";

const TONE = { pending: "warning", approved: "success", rejected: "danger" } as const;

/** A student asks to become a teacher, and sees where that request stands. */
const TeacherRequestPanel = () => {
  const t = useTranslations("account.teacherRequest");
  const format = useFormat();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const { triggerToast } = useToast();
  const { handleError } = useApiError();
  const [request, setRequest] = useState<TeacherRequestSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadRequest = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosReq.get<{ payload: TeacherRequestSummary | null }>(`${baseUrl}/teacher-requests/me`);
      setRequest(res.data?.payload ?? null);
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    } finally {
      setLoading(false);
    }
  }, [baseUrl, handleError]);

  useEffect(() => {
    void loadRequest();
  }, [loadRequest]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await axiosReq.post<{ payload: TeacherRequestSummary }>(`${baseUrl}/teacher-requests`);
      setRequest(res.data.payload);
      triggerToast({ title: t("doneTitle"), description: t("doneDetail"), type: "success" });
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = !request || request.status === "rejected";

  return (
    <Card title={t("title")} description={t("intro")}>
      {loading ? (
        <Skeleton lines={2} />
      ) : (
        <div className="flex flex-col gap-4">
          {request ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-body-sm text-ink-muted">{t("statusLabel")}</span>
              <StatusPill tone={TONE[request.status]}>{t(`status.${request.status}`)}</StatusPill>
              {request.created_at ? (
                <span className="text-body-sm text-ink-muted">{t("sentOn", { date: format.date(request.created_at) })}</span>
              ) : null}
            </div>
          ) : null}
          {request?.status === "pending" ? <p className="text-body-sm text-ink-muted">{t("pendingNote")}</p> : null}
          {request?.status === "approved" ? <p className="text-body-sm text-success">{t("approvedNote")}</p> : null}
          {canSubmit ? (
            <Button className="self-start" loading={submitting} onClick={() => void handleSubmit()}>
              {request?.status === "rejected" ? t("again") : t("submit")}
            </Button>
          ) : null}
        </div>
      )}
    </Card>
  );
};

export default TeacherRequestPanel;
