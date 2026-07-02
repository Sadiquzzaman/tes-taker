"use client";

import useGetSubmissionGradingDetail from "@/hooks/api/grading/useGetSubmissionGradingDetail";
import { setOpenModal } from "@/lib/features/gradeDetailsSlice";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { useEffect, useState } from "react";

const buildDraftMap = (data: GradingModalData | null): GradingQuestionDraftMap => {
  if (!data) {
    return {};
  }

  return data.items.reduce<GradingQuestionDraftMap>((drafts, item) => {
    if (item.kind !== "question" || !item.question.isEditable) {
      return drafts;
    }

    drafts[item.question.id] = {
      score: String(item.question.marksObtained),
      explanation: "",
    };

    return drafts;
  }, {});
};

const isDecimalInput = (value: string) => {
  return value === "" || /^\d*(\.\d*)?$/.test(value);
};

const formatScoreValue = (value: number) => {
  return String(value);
};

const useGradingModal = () => {
  const dispatch = useAppDispatch();
  const { exam, openModal, selectedSubmission } = useAppSelector((state) => state.gradeDetails);
  const [questionDrafts, setQuestionDrafts] = useState<GradingQuestionDraftMap>({});

  const submissionId = selectedSubmission?.submission_id ?? null;
  const examId = exam?.id ?? null;
  const { data, fetch, loading } = useGetSubmissionGradingDetail(examId, submissionId);

  useEffect(() => {
    document.body.style.overflow = openModal ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [openModal]);

  useEffect(() => {
    if (!openModal || !examId || !submissionId) {
      return;
    }

    void fetch();
  }, [examId, fetch, openModal, submissionId]);

  useEffect(() => {
    setQuestionDrafts({});
  }, [submissionId]);

  useEffect(() => {
    if (!openModal) {
      setQuestionDrafts({});
    }
  }, [openModal]);

  useEffect(() => {
    setQuestionDrafts(buildDraftMap(data));
  }, [data]);

  const handleClose = () => {
    setQuestionDrafts({});
    dispatch(setOpenModal(""));
  };

  const handleExplanationChange = (questionId: string, explanation: string) => {
    setQuestionDrafts((previousDrafts) => ({
      ...previousDrafts,
      [questionId]: {
        ...(previousDrafts[questionId] ?? { score: "", explanation: "" }),
        explanation,
      },
    }));
  };

  const handleScoreChange = (questionId: string, score: string) => {
    if (!isDecimalInput(score)) {
      return;
    }

    setQuestionDrafts((previousDrafts) => ({
      ...previousDrafts,
      [questionId]: {
        ...(previousDrafts[questionId] ?? { score: "", explanation: "" }),
        score,
      },
    }));
  };

  const handleScoreBlur = (questionId: string, maxScore: number, currentScore: number) => {
    setQuestionDrafts((previousDrafts) => {
      const currentDraft = previousDrafts[questionId];

      if (!currentDraft) {
        return previousDrafts;
      }

      if (currentDraft.score === "") {
        return {
          ...previousDrafts,
          [questionId]: {
            ...currentDraft,
            score: formatScoreValue(currentScore),
          },
        };
      }

      const parsedScore = Number(currentDraft.score);

      if (Number.isNaN(parsedScore)) {
        return {
          ...previousDrafts,
          [questionId]: {
            ...currentDraft,
            score: formatScoreValue(currentScore),
          },
        };
      }

      const normalizedScore = Math.min(Math.max(parsedScore, 0), maxScore);

      return {
        ...previousDrafts,
        [questionId]: {
          ...currentDraft,
          score: formatScoreValue(normalizedScore),
        },
      };
    });
  };

  const modalTitle = openModal === "edit" ? "Grade Submission" : "View Result";

  return {
    data,
    handleClose,
    handleExplanationChange,
    handleScoreBlur,
    handleScoreChange,
    loading,
    modalTitle,
    openModal,
    questionDrafts,
  };
};

export default useGradingModal;
