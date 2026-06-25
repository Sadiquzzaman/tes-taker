const STORAGE_PREFIX = "exam-answers";

const buildStorageKey = (examId: string, studentId: string) => `${STORAGE_PREFIX}:${examId}:${studentId}`;

export const saveExamAnswersToStorage = (
  examId: string,
  studentId: string,
  values: ExamAnswerState,
): void => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(
      buildStorageKey(examId, studentId),
      JSON.stringify({
        examId,
        studentId,
        values,
        updatedAt: new Date().toISOString(),
      }),
    );
  } catch {
    // Ignore quota or serialization errors.
  }
};

export const loadExamAnswersFromStorage = (
  examId: string,
  studentId: string,
): ExamAnswerState | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = localStorage.getItem(buildStorageKey(examId, studentId));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as { values?: ExamAnswerState };
    return parsed.values ?? null;
  } catch {
    return null;
  }
};

export const clearExamAnswersFromStorage = (examId: string, studentId: string): void => {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.removeItem(buildStorageKey(examId, studentId));
};
