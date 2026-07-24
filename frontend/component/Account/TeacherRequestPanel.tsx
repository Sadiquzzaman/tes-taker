"use client";

import { useCallback, useEffect, useState } from "react";
import { AxiosError } from "axios";
import axiosReq from "@/lib/axios";
import { useToast } from "@/component/Toast/ToastContext";
import { useApiError } from "@/hooks/api/useApiError";

const statusStyles: Record<TeacherRequestStatus, string> = {
  pending: "bg-[#FFF4E5] text-[#B54708]",
  approved: "bg-[#EAF2EB] text-[#49734F]",
  rejected: "bg-[#FEECEC] text-[#D24B44]",
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
      <div className="rounded-2xl border border-[#E5E5E5] bg-white p-6 animate-pulse h-28" />
    );
  }

  const canSubmit = !request || request.status === "rejected";

  return (
    <div className="rounded-2xl border border-[#E5E5E5] bg-white p-6 flex flex-col gap-4">
      <div>
        <p className="text-[20px] font-[600] leading-[24px] tracking-[-0.02em] text-[#232A25]">
          Become a Teacher
        </p>
        <p className="mt-2 text-[14px] leading-[18px] tracking-[-0.02em] text-[#747775]">
          Request a teacher account. An admin will review and approve or reject your request.
        </p>
      </div>

      {request && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[14px] text-[#747775]">Status:</span>
          <span
            className={`rounded-full px-3 py-1 text-[13px] font-[500] capitalize ${statusStyles[request.status]}`}
          >
            {request.status}
          </span>
          {request.created_at && (
            <span className="text-[13px] text-[#747775]">
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
          className="w-fit px-4 h-10 flex items-center justify-center rounded-[8px] bg-[#49734F] text-white text-[14px] font-[500] tracking-[-0.02em] disabled:opacity-60"
        >
          {submitting
            ? "Submitting..."
            : request?.status === "rejected"
              ? "Request again"
              : "Request to Become a Teacher"}
        </button>
      )}

      {request?.status === "pending" && (
        <p className="text-[13px] text-[#747775]">
          Your request is pending review. You can submit only one active request at a time.
        </p>
      )}

      {request?.status === "approved" && (
        <p className="text-[13px] text-[#49734F]">
          Approved. Sign out and sign back in if your teacher menus are not visible yet.
        </p>
      )}
    </div>
  );
};

export default TeacherRequestPanel;
