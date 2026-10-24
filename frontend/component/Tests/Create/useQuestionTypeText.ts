"use client";

import { useTranslations } from "next-intl";
import type { QuestionIssue } from "@/utils/createTestValidation";

/** English prompt placeholders (utils/createTestOptions) -> keys under createTest.prompts. */
const PROMPTS: Record<string, string> = {
  "Write your question here": "default",
  "Write your question here (Use ______ for blank spot)": "blank",
  "Write your question here (e.g. ক / খ / গ / ঘ)": "essayCq",
  "Write summary instruction here": "summary",
  "Write table instruction here": "table",
  "Write diagram instruction here": "diagram",
  "Write task 1 prompt here": "task1",
  "Write task 2 prompt here": "task2",
  "Write speaking part 1 prompt here": "speaking1",
  "Write speaking part 2 prompt here": "speaking2",
  "Write speaking part 3 prompt here": "speaking3",
  "Enter expected answer": "expectedAnswer",
};

/**
 * Translated names for question categories and types, prompt placeholders and validation issues.
 * The question-type catalogue (utils/createTestOptions) keeps English ids and labels; anything
 * without a translation falls back to that English label.
 */
const useQuestionTypeText = () => {
  const t = useTranslations("createTest");

  const lookup = (key: string, fallback: string) => (t.has(key as never) ? t(key as never) : fallback);

  return {
    category: (id: string, fallback = id) => lookup(`categories.${id}`, fallback),
    type: (categoryId: string, subtypeId: string, fallback = subtypeId) => lookup(`types.${categoryId}.${subtypeId}`, fallback),
    prompt: (english?: string | null) => (english ? lookup(`prompts.${PROMPTS[english] ?? "__none"}`, english) : ""),
    issue: (issue: QuestionIssue) => t(`validation.${issue.key}`, issue.values),
  };
};

export default useQuestionTypeText;
