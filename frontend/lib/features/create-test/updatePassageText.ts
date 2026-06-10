import type { PayloadAction } from "@reduxjs/toolkit";
import { findPassageById, findSubjectById } from "./createTestDomain";

const updatePassageText = (
  state: CreateTestState,
  action: PayloadAction<{ subjectId: string; passageId: string; passageText: string }>,
) => {
  const subject = findSubjectById(state.subjects, action.payload.subjectId);

  if (!subject) {
    return;
  }

  const passage = findPassageById(subject.questions, action.payload.passageId);

  if (passage) {
    passage.passageText = action.payload.passageText;
    passage.showValidation = false;
  }
};

export default updatePassageText;
