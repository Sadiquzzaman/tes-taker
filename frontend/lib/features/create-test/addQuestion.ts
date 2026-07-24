import type { PayloadAction } from "@reduxjs/toolkit";
import {
  createPassageQuestion,
  createQuestion,
  findSubjectById,
  findPassageById,
  focusPassage,
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

  const invalidQuestion = getFirstInvalidQuestion(subject.id, subject.questions);

  if (invalidQuestion) {
    showQuestionValidationErrors(subject.questions);

    if (invalidQuestion.targetType === "passage" && invalidQuestion.parentPassageId) {
      focusPassage(state, subject.id, invalidQuestion.parentPassageId);
      return;
    }

    if (invalidQuestion.questionId) {
      focusQuestion(state, subject.id, invalidQuestion.questionId, invalidQuestion.parentPassageId);
    }
    return;
  }

  if (action.payload.questionType === "passage-question") {
    // Only append children to the focused passage. When none is focused, create
    // a new Passage / CQ block so a subject can hold multiple shared contexts.
    const activePassage = state.activePassageId ? findPassageById(subject.questions, state.activePassageId) : null;
    const nextChildQuestion = createQuestion("passage-question", action.payload.subType);

    if (!nextChildQuestion) {
      return;
    }

    if (activePassage) {
      activePassage.childQuestions.push(nextChildQuestion);
      syncSubjectType(subject);
      focusQuestion(state, subject.id, nextChildQuestion.id, activePassage.id);
      return;
    }

    const nextPassage = createPassageQuestion(action.payload.subType);

    if (!nextPassage) {
      return;
    }

    subject.questions.push(nextPassage);
    syncSubjectType(subject);
    focusPassage(state, subject.id, nextPassage.id);
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
