const getInputMode = (
  questionType: SubmissionGradingQuestionType,
  subType: SubmissionGradingQuestionSubType,
): GradingModalInputMode => {
  if (
    subType === "speaking-part-1" ||
    subType === "speaking-part-2" ||
    subType === "speaking-part-3"
  ) {
    return "audio";
  }

  if (questionType === "ungraded" || questionType === "ielts") {
    if (
      subType === "writing-task-1" ||
      subType === "writing-task-2" ||
      subType === "essay" ||
      subType === "fill-in-the-gaps"
    ) {
      return "text";
    }
  }

  if (questionType === "ungraded") {
    return "text";
  }

  if (subType === "matching-ordering") {
    return "matching";
  }

  if (subType === "multiple-response") {
    return "multi-select";
  }

  return subType === "essay" ||
    subType === "fill-in-the-gaps" ||
    subType === "fill-in-the-blanks" ||
    subType === "answer-box" ||
    subType === "sentence-completion" ||
    subType === "summary-completion" ||
    subType === "table-completion" ||
    subType === "diagram-label" ||
    subType === "short-answer" ||
    subType === "writing-task-1" ||
    subType === "writing-task-2"
    ? "text"
    : "single-select";
};

const isManualGradingQuestion = (
  questionType: SubmissionGradingQuestionType,
  subType: SubmissionGradingQuestionSubType,
  isPassageChild: boolean,
) => {
  if (isPassageChild && subType === "essay") {
    return true;
  }
  if (questionType === "ungraded") {
    return true;
  }
  if (questionType === "ielts") {
    return (
      subType === "writing-task-1" ||
      subType === "writing-task-2" ||
      subType.startsWith("speaking-part-")
    );
  }
  return false;
};

const normalizeOptionList = (options?: SubmissionGradingOptionApi[]): GradingModalOption[] => {
  return (options ?? []).map((option) => ({
    id: option.id,
    text: option.text,
    imageUrl: option.image_url,
  }));
};

const normalizeMatchingOptions = (
  matchingOptions?: SubmissionGradingQuestionApi["matchingOptions"],
): GradingModalQuestion["matchingOptions"] => {
  if (!matchingOptions) {
    return undefined;
  }

  return {
    left: matchingOptions.left.map((option) => ({
      id: option.id,
      text: option.text,
      imageUrl: option.image,
    })),
    right: matchingOptions.right.map((option) => ({
      id: option.id,
      text: option.text,
      imageUrl: option.image,
    })),
  };
};

const normalizeMatchingStudentSelected = (studentSelected: string[]): string[] => {
  return studentSelected.flatMap((value) =>
    value
      .split(/[|,]/g)
      .map((pair) => pair.trim())
      .filter(Boolean),
  );
};

const buildQuestion = (
  question: SubmissionGradingQuestionApi,
  questionNumber: number,
  isPassageChild: boolean,
): GradingModalQuestion => {
  const selectedAnswerValues =
    question.answer.type === "text"
      ? []
      : question.answer.type === "matchingOrdering"
        ? normalizeMatchingStudentSelected(question.answer.student_selected)
        : question.answer.student_selected;

  const correctAnswerValues =
    question.answer.type === "text"
      ? []
      : question.answer.type === "matchingOrdering"
        ? normalizeMatchingStudentSelected(question.answer.correct_answer)
        : question.answer.correct_answer;

  return {
    id: question.question_id,
    type: question.type,
    subType: question.sub_type,
    questionNumber,
    question: question.question,
    instruction: question.instruction ?? "",
    imageUrl: question.image_url,
    points: question.points,
    marksObtained: question.marks_obtained,
    isCorrect: question.is_correct,
    inputMode: getInputMode(question.type, question.sub_type),
    options: normalizeOptionList(question.options),
    matchingOptions: normalizeMatchingOptions(question.matchingOptions),
    correctAnswerValues,
    selectedAnswerValues,
    textAnswer: question.answer.type === "text" ? question.answer.student_answer : "",
    mediaUrl:
      "media_url" in question.answer
        ? (question.answer as { media_url?: string | null }).media_url ?? null
        : null,
    isEditable: isManualGradingQuestion(question.type, question.sub_type, isPassageChild),
    isPassageChild,
  };
};

export const normalizeSubmissionGradingDetail = (payload: SubmissionGradingDetailPayload): GradingModalData => {
  let questionNumber = 1;

  const items = payload.questions.map<GradingModalItem>((questionItem) => {
    if ("childQuestions" in questionItem) {
      const questions = questionItem.childQuestions.map((childQuestion) => {
        const normalizedQuestion = buildQuestion(childQuestion, questionNumber, true);
        questionNumber += 1;
        return normalizedQuestion;
      });

      return {
        kind: "passage",
        id: questionItem.id,
        passageText: questionItem.passageText,
        questions,
      };
    }

    const question = buildQuestion(questionItem, questionNumber, false);
    questionNumber += 1;

    return {
      kind: "question",
      id: question.id,
      question,
    };
  });

  return {
    submission: {
      submissionId: payload.submission.submission_id,
      examId: payload.submission.exam_id,
      studentId: payload.submission.student_id,
      studentName: payload.submission.student_name,
      email: payload.submission.email,
      phone: payload.submission.phone,
      submittedAt: payload.submission.submitted_at,
      status: payload.submission.status,
      totalScore: payload.submission.total_score,
      maxScore: payload.submission.max_score,
      percentage: payload.submission.percentage,
      isGraded: payload.submission.is_graded,
      gradingStatus: payload.submission.grading_status,
    },
    totals: {
      manualTotalCount: payload.totals.manual_total_count,
      manualGradedCount: payload.totals.manual_graded_count,
      autoTotalCount: payload.totals.auto_total_count,
      autoGradedCount: payload.totals.auto_graded_count,
    },
    items,
    questionCount: questionNumber - 1,
  };
};
