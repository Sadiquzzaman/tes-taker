/**
 * Redis cache-aside for assembled exam graphs used by student take/finalize flows.
 * PostgreSQL remains the source of truth; Redis is a read-through cache only.
 */
export const EXAM_PAPER_CACHE_KEY_PREFIX = 'exam:paper:';

/** Safety-net TTL. Correctness relies primarily on explicit invalidation after mutations. */
export const EXAM_PAPER_CACHE_TTL_SECONDS = 6 * 60 * 60; // 6 hours

export const examPaperCacheKey = (examId: string): string =>
  `${EXAM_PAPER_CACHE_KEY_PREFIX}${examId}`;

/**
 * Relations required to assemble the student paper and to run access checks that
 * depend on target/excluded student lists. Class membership is resolved live via
 * ClassService (not via nested classStudents) to avoid loading the full roster.
 */
export const EXAM_PAPER_RELATIONS = [
  'class',
  'excluded_students',
  'questions',
  'questionSections',
  'questionSections.questions',
  'questionSections.subject',
  'target_students',
  'primary_subject',
] as const;
