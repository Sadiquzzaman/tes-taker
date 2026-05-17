import type { PayloadAction } from "@reduxjs/toolkit";
import type { InvalidQuestionPayload } from "./createTestActionPayloads";
import { focusQuestion } from "./createTestDomain";

const setQuestionValidationState = (state: CreateTestState, action: PayloadAction<InvalidQuestionPayload[]>) => {
  const invalidQuestions = new Set(action.payload.map((item) => `${item.subjectId}:${item.sectionId}:${item.questionId}`));

  state.subjects.forEach((subject) => {
    subject.questionSections.forEach((section) => {
      section.questions.forEach((question) => {
        question.showValidation = invalidQuestions.has(`${subject.id}:${section.id}:${question.id}`);
      });
    });
  });

  const firstInvalidQuestion = action.payload[0];

  if (firstInvalidQuestion) {
    focusQuestion(state, firstInvalidQuestion.subjectId, firstInvalidQuestion.sectionId, firstInvalidQuestion.questionId);
  }
};

export default setQuestionValidationState;