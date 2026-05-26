export type SubjectSelectionPayload = {
  label: string;
  value: string;
  id: string;
};

export type SubjectQuestionTypePayload = {
  subjectId: string;
  questionType: CreateTestQuestionCategory;
  subType: string;
};

export type QuestionPayload = {
  subjectId: string;
  questionId: string;
};

export type QuestionAnswerValuePayload = QuestionPayload & {
  index: number;
  value: string;
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
  questionId: string;
};

export type SetPublishFieldPayload = {
  field: keyof Omit<PublishState, "publishTiming" | "testAudience" | "excluded_students">;
  value: string;
};
