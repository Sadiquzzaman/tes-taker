import type { PayloadAction } from "@reduxjs/toolkit";
import { focusQuestion } from "./createTestDomain";

const setQuestionValidationState = (state: CreateTestState, action: PayloadAction<InvalidQuestionPayload[]>) => {
  const invalidQuestions = new Set(action.payload.map((item) => `${item.subjectId}:${item.questionId}`));

  state.subjects.forEach((subject) => {
    subject.questions.forEach((question) => {
      question.showValidation = invalidQuestions.has(`${subject.id}:${question.id}`);
    });
  });

  const firstInvalidQuestion = action.payload[0];

  if (firstInvalidQuestion) {
    focusQuestion(state, firstInvalidQuestion.subjectId, firstInvalidQuestion.questionId);
  }
};

export default setQuestionValidationState;
