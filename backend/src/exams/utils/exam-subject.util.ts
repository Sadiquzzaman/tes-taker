import { ExamEntity } from '../entities/exam.entity';

/**
 * Resolves the display subject name for an exam.
 * Uses linked subject entities — never the test title (test_name).
 */
export const resolveExamSubjectLabel = (exam: ExamEntity): string | null => {
  if (exam.primary_subject?.name) {
    return exam.primary_subject.name;
  }

  const sectionNames = [
    ...new Set(
      (exam.questionSections ?? [])
        .map((section) => section.subject?.name?.trim())
        .filter((name): name is string => Boolean(name)),
    ),
  ];

  if (sectionNames.length === 1) {
    return sectionNames[0];
  }

  if (sectionNames.length > 1) {
    return `${sectionNames[0]} +${sectionNames.length - 1} more`;
  }

  return exam.subject ?? null;
};
