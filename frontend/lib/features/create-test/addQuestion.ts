import type { PayloadAction } from "@reduxjs/toolkit";
import type { SubjectQuestionTypePayload } from "./createTestActionPayloads";
import {
  createQuestion,
  findSubjectById,
  focusQuestion,
  getFirstInvalidQuestion,
  getSubjectQuestionsByType,
  showQuestionValidationErrors,
  syncSubjectType,
} from "./createTestDomain";

const addQuestion = (state: CreateTestState, action: PayloadAction<SubjectQuestionTypePayload>) => {
  const subject = findSubjectById(state.subjects, action.payload.subjectId);

  if (!subject) {
    return;
  }

  const questionsOfType = getSubjectQuestionsByType(subject, action.payload.questionType);
  const invalidQuestion = getFirstInvalidQuestion(questionsOfType);

  if (invalidQuestion) {
    showQuestionValidationErrors(questionsOfType);
    focusQuestion(state, subject.id, invalidQuestion.id);
    return;
  }

  const nextQuestion = createQuestion(action.payload.questionType);

  subject.questions.push(nextQuestion);
  syncSubjectType(subject);
  focusQuestion(state, subject.id, nextQuestion.id);
};

export default addQuestion;
