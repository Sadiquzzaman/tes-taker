const STORAGE_PREFIX = "exam-answers";

const buildStorageKey = (examId: string, studentId: string) => `${STORAGE_PREFIX}:${examId}:${studentId}`;

/**
 * Answers kept on the device while writing. `attempt` (the attempt's start time) ties them to one
 * attempt, so a retake (P8-04) never brings back the answers of the attempt before it.
 */
export const saveExamAnswersToStorage = (examId: string, studentId: string, values: ExamAnswerState, attempt?: string | null): void => {
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
        attempt: attempt ?? null,
        updatedAt: new Date().toISOString(),
      }),
    );
  } catch {
    // Ignore quota or serialization errors.
  }
};

export const loadExamAnswersFromStorage = (examId: string, studentId: string, attempt?: string | null): ExamAnswerState | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = localStorage.getItem(buildStorageKey(examId, studentId));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as { values?: ExamAnswerState; attempt?: string | null };
    // Saved for another attempt of this exam: not this one's answers.
    if (attempt && parsed.attempt && parsed.attempt !== attempt) {
      return null;
    }
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
