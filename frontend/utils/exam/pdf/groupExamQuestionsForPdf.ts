import type { PdfSectionMessageKey } from "./pdfSectionMessages";

type StandardQuestion = StudentExamStandardQuestion;

const BUCKET_ORDER: Array<{ type: "graded" | "ungraded"; subType: StudentExamQuestionSubType; messageKey: PdfSectionMessageKey | null }> = [
  { type: "graded", subType: "multiple-choice", messageKey: "multipleChoice" },
  { type: "graded", subType: "multiple-response", messageKey: "multipleChoice" },
  { type: "graded", subType: "true-false", messageKey: "trueFalse" },
  { type: "ungraded", subType: "true-false", messageKey: "trueFalse" },
  { type: "graded", subType: "fill-in-the-blanks", messageKey: "fillInGaps" },
  { type: "ungraded", subType: "fill-in-the-gaps", messageKey: "fillInGaps" },
  { type: "graded", subType: "matching-ordering", messageKey: "matching" },
  { type: "ungraded", subType: "essay", messageKey: null },
];

export interface PdfQuestionGroup {
  messageKey: PdfSectionMessageKey | null;
  questions: StandardQuestion[];
}

export interface PdfPassageBlock {
  passage: StudentExamPassageQuestion;
}

export interface PdfSubjectLayout {
  groups: PdfQuestionGroup[];
  passages: PdfPassageBlock[];
}

const isPassageQuestion = (question: StudentExamSubjectQuestion): question is StudentExamPassageQuestion =>
  "passageText" in question && Boolean(question.passageText);

const isStandardQuestion = (question: StudentExamSubjectQuestion): question is StandardQuestion =>
  !isPassageQuestion(question);

const bucketKey = (type: string, subType: string) => `${type}:${subType}`;

export const groupExamQuestionsForPdf = (subject: StudentExamSubject): PdfSubjectLayout => {
  const buckets = new Map<string, StandardQuestion[]>();
  const passages: PdfPassageBlock[] = [];

  for (const question of subject.questions) {
    if (isPassageQuestion(question)) {
      passages.push({ passage: question });
      continue;
    }

    if (!isStandardQuestion(question)) {
      continue;
    }

    const type = question.type ?? "graded";
    const subType = question.subType ?? "multiple-choice";
    const key = bucketKey(type, subType);
    const list = buckets.get(key) ?? [];
    list.push(question);
    buckets.set(key, list);
  }

  const shownMessages = new Set<PdfSectionMessageKey>();
  const groups: PdfQuestionGroup[] = [];

  for (const bucket of BUCKET_ORDER) {
    const key = bucketKey(bucket.type, bucket.subType);
    const questions = buckets.get(key);
    if (!questions?.length) {
      continue;
    }

    let messageKey: PdfSectionMessageKey | null = null;
    if (bucket.messageKey && !shownMessages.has(bucket.messageKey)) {
      messageKey = bucket.messageKey;
      shownMessages.add(bucket.messageKey);
    }

    groups.push({ messageKey, questions });
  }

  return { groups, passages };
};
