import type { PayloadAction } from "@reduxjs/toolkit";
import type { SubjectSectionPayload } from "./createTestActionPayloads";
import { findSubjectSection } from "./createTestDomain";

const updateSectionInstruction = (
  state: CreateTestState,
  action: PayloadAction<SubjectSectionPayload & { instruction: string }>,
) => {
  const { section } = findSubjectSection(state.subjects, action.payload.subjectId, action.payload.sectionId);

  if (section) {
    section.instruction = action.payload.instruction;
  }
};

export default updateSectionInstruction;
