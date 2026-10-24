"use client";

import useGetSubmissionGradingDetail from "@/hooks/api/grading/useGetSubmissionGradingDetail";
import { setOpenModal } from "@/lib/features/gradeDetailsSlice";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

const useGradingModal = () => {
  const t = useTranslations("grading.modal");
  const dispatch = useAppDispatch();
  const { exam, openModal, selectedSubmission } = useAppSelector((state) => state.gradeDetails);
  const examId = exam?.id ?? null;
  const submissionId = selectedSubmission?.submission_id ?? null;
  const { data, fetch, loading } = useGetSubmissionGradingDetail(examId, submissionId);

  useEffect(() => {
    if (!openModal || !examId || !submissionId) {
      return;
    }

    void fetch();
  }, [examId, fetch, openModal, submissionId]);

  const handleClose = () => {
    dispatch(setOpenModal(""));
  };

  const modalTitle = openModal === "edit" ? t("grade") : t("result");

  return {
    data,
    handleClose,
    loading,
    modalTitle,
    openModal,
  };
};

export default useGradingModal;
