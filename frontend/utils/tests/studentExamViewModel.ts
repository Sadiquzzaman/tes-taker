const MATCHING_SUB_TYPE = "matching-ordering";
const MULTI_SELECT_SUB_TYPE = "multiple-response";

const AUTO_SCORED_SUB_TYPES = [
  "multiple-choice",
  "multiple-response",
  "true-false",
  "true-false-not-given",
  "yes-no-not-given",
  "fill-in-the-blanks",
  "answer-box",
  "matching-ordering",
  "sentence-completion",
  "summary-completion",
  "table-completion",
  "diagram-label",
  "short-answer",
] as const;

const TEXT_SUB_TYPES = new Set([
  "essay",
  "fill-in-the-gaps",
  "fill-in-the-blanks",
  "answer-box",
  "sentence-completion",
  "summary-completion",
  "table-completion",
  "diagram-label",
  "short-answer",
  "writing-task-1",
  "writing-task-2",
]);

const SPEAKING_SUB_TYPES = new Set(["speaking-part-1", "speaking-part-2", "speaking-part-3"]);

const getInputMode = (
  questionType: StudentExamQuestionType,
  subType: string,
): StudentExamQuestionInputMode => {
  if (SPEAKING_SUB_TYPES.has(subType)) {
    return "audio-record";
  }

  if (questionType === "ungraded") {
    return "text";
  }

  if (subType === MATCHING_SUB_TYPE) {
    return "matching";
  }

  if (subType === MULTI_SELECT_SUB_TYPE) {
    return "multi-select";
  }

  if (TEXT_SUB_TYPES.has(subType)) {
    return "text";
  }

  return "single-select";
};

const isAutoScoredViewQuestion = (questionType: StudentExamQuestionType, subType: string) => {
  if (questionType === "ungraded") {
    return false;
  }
  if (SPEAKING_SUB_TYPES.has(subType) || subType.startsWith("writing-task-")) {
    return false;
  }
  return (AUTO_SCORED_SUB_TYPES as readonly string[]).includes(subType);
};

const buildViewQuestion = (
  question: StudentExamStandardQuestion | StudentExamPassageChildQuestion | StudentExamIeltsQuestion,
  questionNumber: number,
): StudentExamViewQuestion => ({
  id: question.id,
  type: question.type,
  subType: question.subType as StudentExamQuestionSubType,
  text: question.text,
  instruction: question.instruction,
  image: question.image,
  options: question.options,
  matchingOptions: "matchingOptions" in question ? question.matchingOptions : undefined,
  points: question.points,
  showValidation: question.showValidation,
  audioUrl: question.audioUrl,
  timeLimitSeconds: question.timeLimitSeconds,
  wordLimit: question.wordLimit,
  moduleKey: question.moduleKey,
  mediaMeta: question.mediaMeta,
  inputMode: getInputMode(question.type, question.subType),
  isAutoScored: isAutoScoredViewQuestion(question.type, question.subType),
  questionNumber,
});

const getQuestionCount = (question: StudentExamSubjectQuestion) => {
  if (question.type === "passage-question" && "childQuestions" in question) {
    return question.childQuestions.length;
  }

  return 1;
};

const getQuestionPoints = (question: StudentExamSubjectQuestion) => {
  if (question.type === "passage-question" && "childQuestions" in question) {
    return question.childQuestions.reduce((total, childQuestion) => total + childQuestion.points, 0);
  }

  return "points" in question ? question.points : 0;
};

const buildSubjectSummary = (subjects: StudentExamSubject[]) => {
  if (!subjects.length) {
    return "No subject";
  }

  if (subjects.length === 1) {
    return subjects[0].name;
  }

  return `${subjects[0].name} +${subjects.length - 1} more`;
};

const countSectionQuestions = (items: StudentExamViewItem[]) =>
  items.reduce((count, item) => {
    if (item.kind === "passage") {
      return count + item.questions.length;
    }
    return count + 1;
  }, 0);

export const buildStudentExamViewModel = (exam: StudentExamDetails): StudentExamViewModel => {
  let questionNumber = 1;
  let totalMarks = 0;
  let totalQuestions = 0;
  const examCategory = exam.formState?.examCategory ?? exam.exam_category ?? "academic";

  const flatEntries = exam.subjects
    .flatMap((subject) =>
      subject.questions.map((question) => ({
        subject,
        question,
        sortOrder: question.sortOrder ?? 0,
      })),
    )
    .sort((a, b) => a.sortOrder - b.sortOrder);

  type SectionBucket = {
    id: string;
    title: string;
    subjectName?: string;
    subjectCode?: string;
    items: StudentExamViewItem[];
  };

  const sectionBuckets = new Map<string, SectionBucket>();

  for (const { subject, question } of flatEntries) {
    totalMarks += getQuestionPoints(question);
    totalQuestions += getQuestionCount(question);

    const sectionKey =
      examCategory === "ielts"
        ? subject.moduleKey ?? subject.id
        : exam.subjects.length > 1
          ? subject.id
          : exam.subjects[0]?.id ?? exam.id;

    if (!sectionBuckets.has(sectionKey)) {
      sectionBuckets.set(sectionKey, {
        id: sectionKey,
        title: subject.name,
        subjectName: subject.name,
        subjectCode: subject.code ?? undefined,
        items: [],
      });
    }

    const bucket = sectionBuckets.get(sectionKey)!;

    if (question.type === "passage-question" && "childQuestions" in question) {
      const questions = question.childQuestions.map((childQuestion) => {
        const nextQuestion = buildViewQuestion(childQuestion, questionNumber);
        questionNumber += 1;
        return nextQuestion;
      });

      bucket.items.push({
        id: question.id,
        kind: "passage",
        passageText: question.passageText,
        audioUrl: question.audioUrl ?? undefined,
        title: question.title ?? undefined,
        questions,
      });
      continue;
    }

    const nextQuestion = buildViewQuestion(
      question as StudentExamStandardQuestion | StudentExamIeltsQuestion,
      questionNumber,
    );
    questionNumber += 1;
    bucket.items.push({
      id: question.id,
      kind: "single",
      question: nextQuestion,
    });
  }

  const sections: StudentExamViewSection[] = Array.from(sectionBuckets.values()).map((bucket) => ({
    ...bucket,
    questionCount: countSectionQuestions(bucket.items),
  }));

  return {
    summary: {
      subjectSummary: buildSubjectSummary(exam.subjects),
      totalMarks,
      totalQuestions,
    },
    sections,
    examCategory,
  };
};
