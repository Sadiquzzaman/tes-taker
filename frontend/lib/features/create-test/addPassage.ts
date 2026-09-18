import type { PayloadAction } from "@reduxjs/toolkit";
import { CREATE_TEST_GRADED_MULTIPLE_CHOICE_SUBTYPE_ID } from "@/utils/createTestOptions";
import { isEnglishSubjectName } from "@/utils/richText";
import {
  createPassageQuestion,
  findSubjectById,
  focusPassage,
  focusQuestion,
  getFirstInvalidQuestion,
  showQuestionValidationErrors,
  syncSubjectType,
} from "./createTestDomain";

type AddPassagePayload = {
  subjectId: string;
  subType?: string;
};

const addPassage = (state: CreateTestState, action: PayloadAction<AddPassagePayload>) => {
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

  const nextPassage = createPassageQuestion(
    action.payload.subType ?? CREATE_TEST_GRADED_MULTIPLE_CHOICE_SUBTYPE_ID,
  );

  if (!nextPassage) {
    return;
  }

  nextPassage.subjectId = subject.id;
  nextPassage.instructionLanguage = isEnglishSubjectName(subject.name, subject.value) ? "en" : "bn";
  nextPassage.childQuestions.forEach((child) => {
    child.subjectId = subject.id;
  });

  subject.questions.push(nextPassage);
  syncSubjectType(subject);
  focusPassage(state, subject.id, nextPassage.id);
};

export default addPassage;
