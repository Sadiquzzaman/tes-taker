export type SubjectSelectionPayload = {
  label: string;
  value: string;
  id: string;
};

export type SubjectSectionPayload = {
  subjectId: string;
  sectionId: string;
};

export type QuestionPayload = SubjectSectionPayload & {
  questionId: string;
};

export type OptionPayload = QuestionPayload & {
  optionId: string;
};

export type SetFormFieldPayload = {
  field: keyof FormState;
  value: FormState[keyof FormState];
};

export type InvalidQuestionPayload = {
  subjectId: string;
  sectionId: string;
  questionId: string;
};

export type SetPublishFieldPayload = {
  field: keyof Omit<PublishState, "publishTiming" | "testAudience" | "excluded_students">;
  value: string;
};
