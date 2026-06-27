import type { PayloadAction } from "@reduxjs/toolkit";
import createInitialState from "./createInitialState";
import { createSubject } from "./createTestDomain";

type ApiOption = { id: string; text: string; image?: string | null };

type ApiQuestion = {
  id: string;
  type?: string;
  subType?: string;
  text?: string;
  instruction?: string | null;
  points?: number | null;
  options?: ApiOption[];
  matchingOptions?: { left: ApiOption[]; right: ApiOption[] };
  answer?: { type: QuestionAnswerType; value: string[] };
  passageText?: string;
  childQuestions?: ApiQuestion[];
};

const mapOptions = (options?: ApiOption[]): QuestionOption[] | undefined =>
  options?.map((option) => ({ id: option.id, text: option.text ?? "", image: null }));

const mapGradedQuestion = (question: ApiQuestion): QuestionItem => ({
  id: question.id,
  type: "graded",
  subType: question.subType ?? "",
  text: question.text ?? "",
  instruction: question.instruction ?? "",
  image: null,
  options: mapOptions(question.options),
  matchingOptions: question.matchingOptions
    ? {
        left: mapOptions(question.matchingOptions.left) ?? [],
        right: mapOptions(question.matchingOptions.right) ?? [],
      }
    : undefined,
  answer: question.answer ? { type: question.answer.type, value: [...question.answer.value] } : undefined,
  points: Number(question.points ?? 2),
  showValidation: false,
});

const mapUngradedQuestion = (question: ApiQuestion): QuestionItem => ({
  id: question.id,
  type: "ungraded",
  subType: question.subType ?? "",
  text: question.text ?? "",
  instruction: question.instruction ?? "",
  image: null,
  answer: undefined,
  points: Number(question.points ?? 2),
  showValidation: false,
});

const mapRootQuestion = (question: ApiQuestion): RootQuestionItem => {
  if (question.type === "passage-question" || Array.isArray(question.childQuestions)) {
    return {
      id: question.id,
      type: "passage-question",
      passageText: question.passageText ?? "",
      childQuestions: (question.childQuestions ?? []).map(mapGradedQuestion),
      showValidation: false,
    };
  }

  if (question.type === "ungraded") {
    return mapUngradedQuestion(question);
  }

  return mapGradedQuestion(question);
};

const toStringOrEmpty = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined || value === "") {
    return "";
  }
  return String(value);
};

const hydrateFromExam = (_state: CreateTestState, action: PayloadAction<TeacherExamDetails>): CreateTestState => {
  const exam = action.payload;
  const initial = createInitialState();

  const subjects = (exam.subjects ?? []).map((subject) =>
    createSubject(
      {
        id: subject.id,
        name: subject.name ?? "",
        value: subject.code ?? subject.id,
      },
      ((subject.questions ?? []) as unknown as ApiQuestion[]).map(mapRootQuestion),
    ),
  );

  return {
    ...initial,
    editExamId: exam.id,
    formState: {
      testName: exam.formState?.testName ?? "",
      duration: toStringOrEmpty(exam.formState?.duration),
      passingScore: toStringOrEmpty(exam.formState?.passingScore),
      allowNegativeMarking: Boolean(exam.formState?.allowNegativeMarking),
      negativeMarking: toStringOrEmpty(exam.formState?.negativeMarking),
    },
    subjects,
    activeSubjectId: subjects[0]?.id ?? null,
    publishState: {
      publishTiming: exam.publishState?.publishTiming === "later" ? "later" : "immediately",
      scheduleAt: exam.publishState?.scheduleAt
        ? new Date(exam.publishState.scheduleAt).toISOString()
        : initial.publishState.scheduleAt,
      endingAt: exam.publishState?.endingAt
        ? new Date(exam.publishState.endingAt).toISOString()
        : initial.publishState.endingAt,
      testAudience: (exam.publishState?.testAudience as TestAudience) ?? "anyone",
      selectedClassId: exam.publishState?.selectedClassId ?? exam.class_id ?? "",
      excluded_students: exam.publishState?.excluded_students ?? [],
    },
  };
};

export default hydrateFromExam;
