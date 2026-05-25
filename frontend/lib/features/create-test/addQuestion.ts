import type { PayloadAction } from "@reduxjs/toolkit";
import type { SubjectQuestionTypePayload } from "./createTestActionPayloads";
import {
  createQuestion,
  findSubjectById,
  focusQuestion,
  getFirstInvalidQuestion,
  showQuestionValidationErrors,
  syncSubjectType,
} from "./createTestDomain";

const addQuestion = (state: CreateTestState, action: PayloadAction<SubjectQuestionTypePayload>) => {
  const subject = findSubjectById(state.subjects, action.payload.subjectId);

  if (!subject) {
    return;
  }

  const invalidQuestion = getFirstInvalidQuestion(subject.questions);

  if (invalidQuestion) {
    showQuestionValidationErrors(subject.questions);
    focusQuestion(state, subject.id, invalidQuestion.id);
    return;
  }

  const nextQuestion = createQuestion(action.payload.questionType, action.payload.subType);

  if (!nextQuestion) {
    return;
  }

  subject.questions.push(nextQuestion);
  syncSubjectType(subject);
  focusQuestion(state, subject.id, nextQuestion.id);
};

export default addQuestion;
