export type PdfSectionMessageKey = "multipleChoice" | "trueFalse" | "fillInGaps" | "matching" | "passage";

interface SectionMessageContent {
  bengali: string;
  english: string;
  englishOnly: string;
}

const SECTION_MESSAGES: Record<PdfSectionMessageKey, SectionMessageContent> = {
  multipleChoice: {
    bengali: "নিম্নলিখিত বহুনির্বাচনী প্রশ্নগুলোর উত্তর দাও",
    english: "(Answer the following multiple choice questions)",
    englishOnly: "Answer the following multiple choice questions",
  },
  trueFalse: {
    bengali: "নিম্নলিখিত প্রশ্নগুলো সত্য/মিথ্যা এ উত্তর দাও",
    english: "(Answer the following question in True/False. If false give the correct answer)",
    englishOnly: "Answer the following question in True/False (If false give the correct answer)",
  },
  fillInGaps: {
    bengali: "নিম্নলিখিত শূন্যস্থান পূরণ কর",
    english: "(Answer the following fill in the gaps)",
    englishOnly: "Answer the following fill in the gaps",
  },
  matching: {
    bengali: "বাম পাশ থেকে ডান পাশের উপযুক্ত উত্তরের সাথে মিলাও",
    english: "(Match from left side to right side with suitable answer)",
    englishOnly: "Match from left side to right side with suitable answer",
  },
  passage: {
    bengali: "নিচের অনুচ্ছেদটি পড়ো এবং নিম্নলিখিত প্রশ্নগুলোর উত্তর দাও",
    english: "(Read the passage below and answer the following questions.)",
    englishOnly: "Read the passage below and answer the following questions.",
  },
};

export const isEnglishSubject = (subject: StudentExamSubject): boolean => {
  const name = subject.name ?? "";
  const code = (subject.code ?? "").toLowerCase();
  return /english/i.test(name) || code === "english" || code === "eng";
};

export const getSectionMessageParts = (
  key: PdfSectionMessageKey,
  subject: StudentExamSubject,
): { bengali: string | null; english: string } => {
  const messages = SECTION_MESSAGES[key];

  if (isEnglishSubject(subject)) {
    return { bengali: null, english: messages.englishOnly };
  }

  return { bengali: messages.bengali, english: messages.english };
};

export const getPdfClassLabel = (className: string | null | undefined): string => {
  const trimmed = className?.trim();
  return trimmed || "Open exam";
};
