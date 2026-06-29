"use client";

import { setOpenModal } from "@/lib/features/gradeDetailsSlice";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { useEffect, useMemo, useState } from "react";
import { template } from "@/utils/grading/gradingTemplate";

const useGradingModal = () => {
  const dispatch = useAppDispatch();
  const { openModal } = useAppSelector((state) => state.gradeDetails);
  const [questionInputData, setQuestionInputData] = useState<GradingQuestionInputData>({});

  useEffect(() => {
    document.body.style.overflow = openModal ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [openModal]);

  const allQuestion = useMemo(() => {
    return template.subjects.map((subject) => ({
      name: subject.name,
      questionList: subject.questionSections.flatMap((section) =>
        section.questions.map((question) => ({ ...question, type: section.type })),
      ) as GradingQuestionWithType[],
    }));
  }, []);

  const handleClose = () => {
    dispatch(setOpenModal(""));
  };

  const handleExplanationChange = (questionId: string, explanation: string) => {
    setQuestionInputData((previousValue) => ({
      ...previousValue,
      [questionId]: {
        ...previousValue[questionId],
        explanation,
      },
    }));
  };

  return {
    allQuestion,
    openModal,
    handleClose,
    handleExplanationChange,
    questionInputData,
  };
};

export default useGradingModal;
