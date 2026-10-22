import type { PayloadAction } from "@reduxjs/toolkit";
import { findPassageById, findSubjectById } from "./createTestDomain";

const updatePassageInstructionLanguage = (
  state: CreateTestState,
  action: PayloadAction<{
    subjectId: string;
    passageId: string;
    instructionLanguage: PassageInstructionLanguage;
  }>,
) => {
  const subject = findSubjectById(state.subjects, action.payload.subjectId);

  if (!subject) {
    return;
  }

  const passage = findPassageById(subject.questions, action.payload.passageId);

  if (!passage) {
    return;
  }

  passage.instructionLanguage = action.payload.instructionLanguage;
};

export default updatePassageInstructionLanguage;
