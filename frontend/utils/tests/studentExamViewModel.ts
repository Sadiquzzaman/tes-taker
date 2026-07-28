const MATCHING_SUB_TYPE: StudentExamAutoScoredSubType = "matching-ordering";
const MULTI_SELECT_SUB_TYPE: StudentExamAutoScoredSubType = "multiple-response";
const AUTO_SCORED_SUB_TYPES: StudentExamAutoScoredSubType[] = [
  "multiple-choice",
  "multiple-response",
  "true-false",
  "fill-in-the-blanks",
  "matching-ordering",
];

const getInputMode = (
  questionType: StudentExamQuestionType,
  subType: StudentExamQuestionSubType,
): StudentExamQuestionInputMode => {
  if (questionType === "ungraded") {
    return "text";
  }

  if (subType === MATCHING_SUB_TYPE) {
    return "matching";
  }

  if (subType === MULTI_SELECT_SUB_TYPE) {
    return "multi-select";
  }

  if (subType === "essay" || subType === "fill-in-the-gaps" || subType === "fill-in-the-blanks") {
    return "text";
  }

  return "single-select";
};

const isAutoScoredViewQuestion = (
  questionType: StudentExamQuestionType,
  subType: StudentExamQuestionSubType,
) => questionType !== "ungraded" && AUTO_SCORED_SUB_TYPES.includes(subType as StudentExamAutoScoredSubType);

const buildViewQuestion = (
  question: StudentExamStandardQuestion | StudentExamPassageChildQuestion,
  questionNumber: number,
): StudentExamViewQuestion => ({
  id: question.id,
  type: question.type,
  subType: question.subType,
  text: question.text,
  instruction: question.instruction,
  image: question.image,
  options: question.options,
  matchingOptions: "matchingOptions" in question ? question.matchingOptions : undefined,
  points: question.points,
  showValidation: question.showValidation,
  inputMode: getInputMode(question.type, question.subType),
  isAutoScored: isAutoScoredViewQuestion(question.type, question.subType),
  questionNumber,
});

const getQuestionCount = (question: StudentExamSubjectQuestion) => {
  if (question.type === "passage-question") {
    return question.childQuestions.length;
  }

  return 1;
};

const getQuestionPoints = (question: StudentExamSubjectQuestion) => {
  if (question.type === "passage-question") {
    return question.childQuestions.reduce((total, childQuestion) => total + childQuestion.points, 0);
  }

  return question.points;
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

export const buildStudentExamViewModel = (exam: StudentExamDetails): StudentExamViewModel => {
  let questionNumber = 1;
  let totalMarks = 0;
  let totalQuestions = 0;

  const sections = exam.subjects.map<StudentExamViewSection>((subject) => {
    const items = subject.questions.map<StudentExamViewItem>((question) => {
      totalMarks += getQuestionPoints(question);
      totalQuestions += getQuestionCount(question);

      if (question.type === "passage-question") {
        const questions = question.childQuestions.map((childQuestion) => {
          const nextQuestion = buildViewQuestion(childQuestion, questionNumber);
          questionNumber += 1;
          return nextQuestion;
        });

        return {
          id: question.id,
          kind: "passage",
          passageText: question.passageText,
          questions,
        };
      }

      const nextQuestion = buildViewQuestion(question, questionNumber);
      questionNumber += 1;

      return {
        id: question.id,
        kind: "single",
        question: nextQuestion,
      };
    });

    return {
      id: subject.id,
      title: subject.name,
      subjectName: subject.name,
      subjectCode: subject.code ?? undefined,
      questionCount: items.reduce((count, item) => {
        if (item.kind === "passage") {
          return count + item.questions.length;
        }

        return count + 1;
      }, 0),
      items,
    };
  });

  return {
    summary: {
      subjectSummary: buildSubjectSummary(exam.subjects),
      totalMarks,
      totalQuestions,
    },
    sections,
  };
};
