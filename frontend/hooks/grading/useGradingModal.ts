"use client";

import { useEffect, useMemo, useState } from "react";
import { template } from "@/utils/grading/gradingTemplate";

type QuestionInputData = Record<string, { explanation: string }>;

const useGradingModal = (setOpenModal: (open: GradingModalView) => void, openModal: GradingModalView) => {
  const [questionInputData, setQuestionInputData] = useState<QuestionInputData>({});

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
    setOpenModal("");
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
    handleClose,
    handleExplanationChange,
    questionInputData,
  };
};

export default useGradingModal;
