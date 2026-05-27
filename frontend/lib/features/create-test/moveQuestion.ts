import type { PayloadAction } from "@reduxjs/toolkit";
import { findSubjectById, moveQuestionInList } from "./createTestDomain";

const moveQuestion = (state: CreateTestState, action: PayloadAction<QuestionPayload & { targetIndex: number }>) => {
  const subject = findSubjectById(state.subjects, action.payload.subjectId);

  if (subject) {
    subject.questions = moveQuestionInList(subject.questions, action.payload.questionId, action.payload.targetIndex);
  }
};

export default moveQuestion;
