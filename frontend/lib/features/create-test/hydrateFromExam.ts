import type { PayloadAction } from "@reduxjs/toolkit";
import createInitialState from "./createInitialState";
import { createSubject } from "./createTestDomain";
import { syncQuestionOrder } from "./moveQuestionToSubject";

type ApiOption = { id: string; text: string; image?: string | null };

type ApiQuestion = {
  id: string;
  type?: string;
  subType?: string;
  text?: string;
  instruction?: string | null;
  points?: number | null;
  subjectId?: string | null;
  sortOrder?: number | null;
  options?: ApiOption[];
  matchingOptions?: { left: ApiOption[]; right: ApiOption[] };
  answer?: { type: QuestionAnswerType; value: string[] };
  passageText?: string;
  childQuestions?: ApiQuestion[];
};

const mapOptions = (options?: ApiOption[]): QuestionOption[] | undefined =>
  options?.map((option) => ({ id: option.id, text: option.text ?? "", image: null }));

const mapGradedQuestion = (question: ApiQuestion, subjectId?: string): QuestionItem => ({
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
  points: Number(question.points ?? 1),
  subjectId: question.subjectId ?? subjectId,
  showValidation: false,
});

const mapUngradedQuestion = (question: ApiQuestion, subjectId?: string): QuestionItem => ({
  id: question.id,
  type: "ungraded",
  subType: question.subType ?? "",
  text: question.text ?? "",
  instruction: question.instruction ?? "",
  image: null,
  answer: undefined,
  points: Number(question.points ?? 1),
  subjectId: question.subjectId ?? subjectId,
  showValidation: false,
});

const mapRootQuestion = (question: ApiQuestion, subjectId?: string): RootQuestionItem => {
  if (question.type === "passage-question" || Array.isArray(question.childQuestions)) {
    return {
      id: question.id,
      type: "passage-question",
      passageText: question.passageText ?? "",
      childQuestions: (question.childQuestions ?? []).map((child) => mapGradedQuestion(child, subjectId)),
      subjectId: question.subjectId ?? subjectId,
      showValidation: false,
    };
  }

  if (question.type === "ungraded") {
    return mapUngradedQuestion(question, subjectId);
  }

  return mapGradedQuestion(question, subjectId);
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

  const flatWithOrder: { subjectId: string; subjectName: string; subjectCode: string; question: ApiQuestion; sortOrder: number }[] =
    [];

  for (const subject of exam.subjects ?? []) {
    for (const question of (subject.questions ?? []) as unknown as ApiQuestion[]) {
      flatWithOrder.push({
        subjectId: subject.id,
        subjectName: subject.name ?? "",
        subjectCode: subject.code ?? subject.id,
        question,
        sortOrder: Number(question.sortOrder ?? 0),
      });
    }
  }

  flatWithOrder.sort((a, b) => a.sortOrder - b.sortOrder);

  const subjectsById = new Map<string, SubjectItem>();
  for (const entry of flatWithOrder) {
    let subject = subjectsById.get(entry.subjectId);
    if (!subject) {
      subject = createSubject({
        id: entry.subjectId,
        name: entry.subjectName,
        value: entry.subjectCode,
      });
      subjectsById.set(entry.subjectId, subject);
    }
    subject.questions.push(mapRootQuestion(entry.question, entry.subjectId));
  }

  // Preserve subject tabs that had no questions after grouping
  for (const subject of exam.subjects ?? []) {
    if (!subjectsById.has(subject.id)) {
      subjectsById.set(
        subject.id,
        createSubject({
          id: subject.id,
          name: subject.name ?? "",
          value: subject.code ?? subject.id,
        }),
      );
    }
  }

  const subjects = Array.from(subjectsById.values());
  const questionOrder = flatWithOrder.map((entry) => entry.question.id);

  const nextState: CreateTestState = {
    ...initial,
    editExamId: exam.id,
    formState: {
      testName: exam.formState?.testName ?? "",
      duration: toStringOrEmpty(exam.formState?.duration),
      passingScore: toStringOrEmpty(exam.formState?.passingScore),
      allowNegativeMarking: Boolean(exam.formState?.allowNegativeMarking),
      negativeMarking: toStringOrEmpty(exam.formState?.negativeMarking),
      isModelTest: Boolean((exam.formState as { isModelTest?: boolean } | undefined)?.isModelTest),
    },
    subjects,
    questionOrder,
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

  syncQuestionOrder(nextState);
  return nextState;
};

export default hydrateFromExam;
