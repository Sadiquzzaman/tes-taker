import type { PayloadAction } from "@reduxjs/toolkit";
import type { SubjectSectionPayload } from "./createTestActionPayloads";
import {
  createQuestion,
  findSubjectSection,
  focusQuestion,
  getFirstInvalidQuestion,
  showSectionValidationErrors,
} from "./createTestDomain";

const addQuestion = (state: CreateTestState, action: PayloadAction<SubjectSectionPayload>) => {
  const { section, subject } = findSubjectSection(state.subjects, action.payload.subjectId, action.payload.sectionId);

  if (!section || !subject) {
    return;
  }

  const invalidQuestion = getFirstInvalidQuestion(section);

  if (invalidQuestion) {
    showSectionValidationErrors(section);
    focusQuestion(state, subject.id, section.id, invalidQuestion.id);
    return;
  }

  const nextQuestion = createQuestion(section.type);

  section.questions.push(nextQuestion);
  focusQuestion(state, subject.id, section.id, nextQuestion.id);
};

export default addQuestion;