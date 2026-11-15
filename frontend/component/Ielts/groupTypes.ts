/**
 * Question group types of the real paper (IEL-03), as the API checks them (backend
 * ielts/question-groups.ts): where the choices come from and which modules use the type.
 */
export type Choices = "question" | "shared" | "fixed" | "text";

export interface GroupTypeRule {
  type: string;
  choices: Choices;
  modules: IeltsModule[];
  fixed?: string[];
}

const LR: IeltsModule[] = ["LISTENING", "READING"];
const R: IeltsModule[] = ["READING"];

export const GROUP_TYPES: GroupTypeRule[] = [
  { type: "MCQ_SINGLE", choices: "question", modules: LR },
  { type: "MCQ_MULTI", choices: "question", modules: LR },
  { type: "TFNG", choices: "fixed", modules: R, fixed: ["TRUE", "FALSE", "NOT GIVEN"] },
  { type: "YNNG", choices: "fixed", modules: R, fixed: ["YES", "NO", "NOT GIVEN"] },
  { type: "MATCH_HEADINGS", choices: "shared", modules: R },
  { type: "MATCH_INFO", choices: "shared", modules: R },
  { type: "MATCH_FEATURES", choices: "shared", modules: LR },
  { type: "MATCH_ENDINGS", choices: "shared", modules: R },
  { type: "SENTENCE_COMPLETION", choices: "text", modules: LR },
  { type: "SUMMARY_COMPLETION", choices: "text", modules: LR },
  { type: "NOTE_COMPLETION", choices: "text", modules: LR },
  { type: "TABLE_COMPLETION", choices: "text", modules: LR },
  { type: "FLOWCHART_COMPLETION", choices: "text", modules: LR },
  { type: "FORM_COMPLETION", choices: "text", modules: ["LISTENING"] },
  { type: "DIAGRAM_LABEL", choices: "text", modules: LR },
  { type: "SHORT_ANSWER", choices: "text", modules: LR },
];

export const ruleOf = (type: string): GroupTypeRule => GROUP_TYPES.find((g) => g.type === type) ?? GROUP_TYPES[GROUP_TYPES.length - 1];

/** Completion types show their text with gaps; their answers can come from a word box instead. */
export const isCompletion = (type: string) => ruleOf(type).choices === "text" && type !== "SHORT_ANSWER";

/** Letters for a new option: A, B, C… (headings use i, ii, iii… and are typed by hand). */
export const nextKey = (keys: string[]) => {
  for (let i = 0; i < 26; i += 1) {
    const key = String.fromCharCode(65 + i);
    if (!keys.includes(key)) return key;
  }
  return "";
};
