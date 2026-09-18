import type { PayloadAction } from "@reduxjs/toolkit";
import { findPassageById, findSubjectById } from "./createTestDomain";

const updatePassageAudioUrl = (
  state: CreateTestState,
  action: PayloadAction<{ subjectId: string; passageId: string; audioUrl: string }>,
) => {
  const subject = findSubjectById(state.subjects, action.payload.subjectId);

  if (!subject) {
    return;
  }

  const passage = findPassageById(subject.questions, action.payload.passageId);

  if (passage) {
    passage.audioUrl = action.payload.audioUrl;
  }
};

export default updatePassageAudioUrl;
