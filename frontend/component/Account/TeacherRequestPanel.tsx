"use client";

import { useCallback, useEffect, useState } from "react";
import { AxiosError } from "axios";
import axiosReq from "@/lib/axios";
import { useToast } from "@/component/Toast/ToastContext";
import { useApiError } from "@/hooks/api/useApiError";

const statusStyles: Record<TeacherRequestStatus, string> = {
  pending: "bg-warning-soft text-warning",
  approved: "bg-primary-soft text-primary",
  rejected: "bg-danger-soft text-danger",
};

const TeacherRequestPanel = () => {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const { triggerToast } = useToast();
  const { handleError } = useApiError();
  const [request, setRequest] = useState<TeacherRequestSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadRequest = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosReq.get<{ payload: TeacherRequestSummary | null }>(
        `${baseUrl}/teacher-requests/me`,
      );
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
      triggerToast({
        title: "Request submitted",
        description: "An admin will review your request to become a teacher.",
        type: "success",
      });
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6 animate-pulse h-28" />
    );
  }

  const canSubmit = !request || request.status === "rejected";

  return (
    <div className="rounded-2xl border border-border bg-surface p-6 flex flex-col gap-4">
      <div>
        <p className="text-title-sm font-semibold text-ink">
          Become a Teacher
        </p>
        <p className="mt-2 text-body-sm text-ink-muted">
          Request a teacher account. An admin will review and approve or reject your request.
        </p>
      </div>

      {request && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-body-sm text-ink-muted">Status:</span>
          <span
            className={`rounded-full px-3 py-1 text-body-sm font-medium capitalize ${statusStyles[request.status]}`}
          >
            {request.status}
          </span>
          {request.created_at && (
            <span className="text-body-sm text-ink-muted">
              Submitted {new Date(request.created_at).toLocaleDateString()}
            </span>
          )}
        </div>
      )}

      {canSubmit && (
        <button
          type="button"
          disabled={submitting}
          onClick={() => void handleSubmit()}
          className="w-fit px-4 h-10 flex items-center justify-center rounded-input bg-primary text-ink-inverse text-body-sm font-medium disabled:opacity-60"
        >
          {submitting
            ? "Submitting..."
            : request?.status === "rejected"
              ? "Request again"
              : "Request to Become a Teacher"}
        </button>
      )}

      {request?.status === "pending" && (
        <p className="text-body-sm text-ink-muted">
          Your request is pending review. You can submit only one active request at a time.
        </p>
      )}

      {request?.status === "approved" && (
        <p className="text-body-sm text-primary">
          Approved. Sign out and sign back in if your teacher menus are not visible yet.
        </p>
      )}
    </div>
  );
};

export default TeacherRequestPanel;
