import { useCallback, useEffect, useState } from "react";
import axiosReq from "@/lib/axios";
import { AxiosError } from "axios";
import { useApiError } from "@/hooks/api/useApiError";

type ExamAccessReasonCode =
  | "OK"
  | "NOT_STARTED"
  | "ENDED"
  | "ALREADY_SUBMITTED"
  | "DISQUALIFIED"
  | "NOT_ASSIGNED";

interface ExamEligibilityPayload {
  eligible: boolean;
  can_access: boolean;
  reason?: string;
  reason_code: ExamAccessReasonCode;
}

export type ExamMessageVariant =
  | "not-started"
  | "exam-ended"
  | "already-submitted"
  | "disqualified"
  | "time-up"
  | "not-assigned";

export const mapReasonCodeToMessageVariant = (reasonCode?: ExamAccessReasonCode): ExamMessageVariant | null => {
  switch (reasonCode) {
    case "NOT_STARTED":
      return "not-started";
    case "ENDED":
      return "exam-ended";
    case "ALREADY_SUBMITTED":
      return "already-submitted";
    case "DISQUALIFIED":
      return "disqualified";
    case "NOT_ASSIGNED":
      return "not-assigned";
    default:
      return null;
  }
};

const useExamEligibility = (examId: string | null, enabled = true) => {
  const { handleError } = useApiError();
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);
  const [eligibility, setEligibility] = useState<ExamEligibilityPayload | null>(null);

  const checkEligibility = useCallback(async () => {
    if (!examId) {
      setChecked(true);
      setEligibility(null);
      return null;
    }

    setLoading(true);

    try {
      const response = await axiosReq.get<ApiResponse<ExamEligibilityPayload>>(
        `${process.env.NEXT_PUBLIC_BASE_URL}/student/exams/${examId}/eligibility`,
      );

      const payload = response.data.payload;
      setEligibility(payload);
      setChecked(true);
      return payload;
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
      setEligibility(null);
      setChecked(true);
      return null;
    } finally {
      setLoading(false);
    }
  }, [examId, handleError]);

  useEffect(() => {
    if (!enabled || !examId) {
      return;
    }

    void checkEligibility();
  }, [checkEligibility, enabled, examId]);

  return {
    loading,
    checked,
    eligibility,
    checkEligibility,
    messageVariant: mapReasonCodeToMessageVariant(eligibility?.reason_code),
    canEnter: eligibility?.can_access === true,
  };
};

export default useExamEligibility;
