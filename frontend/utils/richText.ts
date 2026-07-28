/** Strip HTML tags for validation / PDF plain-text extraction. */
export const getPlainTextFromHtml = (value: string): string => {
  if (!value) {
    return "";
  }

  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
};

/** Tiptap empty docs often serialize as `<p></p>` — treat as empty string. */
export const normalizeRichTextHtml = (html: string): string => {
  if (!html) {
    return "";
  }

  if (!getPlainTextFromHtml(html) && !/<img\b/i.test(html) && !/data-type=["'](?:math|geometry)/i.test(html)) {
    return "";
  }

  return html;
};

export const hasRichTextContent = (html: string, image?: string | null): boolean =>
  Boolean(getPlainTextFromHtml(html) || image || /<img\b/i.test(html) || /data-type=["'](?:math|geometry)/i.test(html));

export const PASSAGE_INSTRUCTION_EN =
  "Read the passage / CQ below and answer the following questions";

export const PASSAGE_INSTRUCTION_BN =
  "নিচের অনুচ্ছেদ / সৃজনশীল প্রশ্নটি পড়ো এবং নিম্নলিখিত প্রশ্নগুলোর উত্তর দাও";

export const isEnglishSubjectName = (name?: string | null, code?: string | null): boolean => {
  const subjectName = name ?? "";
  const subjectCode = (code ?? "").toLowerCase();
  return /english/i.test(subjectName) || subjectCode === "english" || subjectCode === "eng";
};

export const getPassageInstructionLabel = (subjectName?: string | null, subjectCode?: string | null): string => {
  if (isEnglishSubjectName(subjectName, subjectCode)) {
    return PASSAGE_INSTRUCTION_EN;
  }

  return PASSAGE_INSTRUCTION_BN;
};
