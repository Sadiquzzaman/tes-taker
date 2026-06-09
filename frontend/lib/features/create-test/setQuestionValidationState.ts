import type { PayloadAction } from "@reduxjs/toolkit";
import { focusPassage, focusQuestion, isPassageQuestionItem } from "./createTestDomain";

const setQuestionValidationState = (state: CreateTestState, action: PayloadAction<InvalidQuestionPayload[]>) => {
  const invalidQuestions = new Set(
    action.payload.map(
      (item) =>
        `${item.subjectId}:${item.parentPassageId ?? "root"}:${item.questionId ?? item.parentPassageId}:${item.targetType}`,
    ),
  );

  state.subjects.forEach((subject) => {
    subject.questions.forEach((question) => {
      if (isPassageQuestionItem(question)) {
        question.showValidation = invalidQuestions.has(`${subject.id}:${question.id}:${question.id}:passage`);
        question.childQuestions.forEach((childQuestion) => {
          childQuestion.showValidation = invalidQuestions.has(
            `${subject.id}:${question.id}:${childQuestion.id}:question`,
          );
        });
        return;
      }

      question.showValidation = invalidQuestions.has(`${subject.id}:root:${question.id}:question`);
    });
  });

  const firstInvalidQuestion = action.payload[0];

  if (firstInvalidQuestion) {
    if (firstInvalidQuestion.targetType === "passage" && firstInvalidQuestion.parentPassageId) {
      focusPassage(state, firstInvalidQuestion.subjectId, firstInvalidQuestion.parentPassageId);
      return;
    }

    if (firstInvalidQuestion.questionId) {
      focusQuestion(
        state,
        firstInvalidQuestion.subjectId,
        firstInvalidQuestion.questionId,
        firstInvalidQuestion.parentPassageId,
      );
    }
  }
};

export default setQuestionValidationState;
