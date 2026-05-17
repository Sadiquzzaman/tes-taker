import type { PayloadAction } from "@reduxjs/toolkit";
import type { QuestionPayload } from "./createTestActionPayloads";
import { findSubjectSection, moveQuestionInList } from "./createTestDomain";

const moveQuestion = (state: CreateTestState, action: PayloadAction<QuestionPayload & { targetIndex: number }>) => {
  const { section } = findSubjectSection(state.subjects, action.payload.subjectId, action.payload.sectionId);

  if (section) {
    section.questions = moveQuestionInList(section.questions, action.payload.questionId, action.payload.targetIndex);
  }
};

export default moveQuestion;