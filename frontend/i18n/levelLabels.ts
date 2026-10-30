import type { Locale } from "./config";

/**
 * What the current workspace calls its two academic levels (FND-03): "Class / Section",
 * "Course / Batch" or its own words. Messages name the levels with tokens that are replaced on
 * every render from the `level_labels` cookie:
 *
 *   [[class]] [[Class]] [[classes]] [[Classes]] [[section]] [[Section]] [[sections]] [[Sections]]
 *
 * Lower case for the middle of a sentence, capitalised for the start; Bangla has one word per level.
 */
export type LevelLabelPreset = "CLASS_SECTION" | "COURSE_BATCH" | "CUSTOM";

export type LevelName = { en: { one: string; other: string }; bn: string };

export type LevelLabels = { preset: LevelLabelPreset; class: LevelName; section: LevelName };

export type Level = "class" | "section";

export const LEVELS: Level[] = ["class", "section"];

export const LEVEL_LABEL_MAX_LENGTH = 30;

export const LEVEL_LABEL_PRESETS: Record<Exclude<LevelLabelPreset, "CUSTOM">, LevelLabels> = {
  CLASS_SECTION: {
    preset: "CLASS_SECTION",
    class: { en: { one: "Class", other: "Classes" }, bn: "ক্লাস" },
    section: { en: { one: "Section", other: "Sections" }, bn: "সেকশন" },
  },
  COURSE_BATCH: {
    preset: "COURSE_BATCH",
    class: { en: { one: "Course", other: "Courses" }, bn: "কোর্স" },
    section: { en: { one: "Batch", other: "Batches" }, bn: "ব্যাচ" },
  },
};

export const DEFAULT_LEVEL_LABELS = LEVEL_LABEL_PRESETS.CLASS_SECTION;

/** Cookie with the current workspace's labels, so the server renders them on the first paint. */
export const LEVEL_LABELS_COOKIE = "LEVEL_LABELS";

const COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

/** Every token a message may use, e.g. "[[Classes]]". */
export const LEVEL_TOKEN_PATTERN = /\[\[(class|Class|classes|Classes|section|Section|sections|Sections)\]\]/g;

const isName = (value: unknown): value is string =>
  typeof value === "string" && value.trim() !== "" && value.length <= LEVEL_LABEL_MAX_LENGTH;

const isLevelName = (value: unknown): value is LevelName => {
  const level = value as LevelName | null | undefined;
  return isName(level?.en?.one) && isName(level?.en?.other) && isName(level?.bn);
};

/** Labels from the API or the cookie, or Class / Section when they are missing or malformed. */
export const toLevelLabels = (value: unknown): LevelLabels => {
  const labels = value as Partial<LevelLabels> | null | undefined;
  if (!labels || typeof labels !== "object") return DEFAULT_LEVEL_LABELS;
  if (labels.preset === "CLASS_SECTION" || labels.preset === "COURSE_BATCH") return LEVEL_LABEL_PRESETS[labels.preset];
  if (labels.preset === "CUSTOM" && isLevelName(labels.class) && isLevelName(labels.section)) {
    return { preset: "CUSTOM", class: labels.class, section: labels.section };
  }
  return DEFAULT_LEVEL_LABELS;
};

/** Same names (used to skip a refresh when nothing changed). */
export const sameLevelLabels = (a: LevelLabels, b: LevelLabels) => JSON.stringify(a) === JSON.stringify(b);

/** Lower-cases the first letter for the middle of a sentence, but keeps acronyms such as "HSC". */
const lowerFirst = (word: string) => (/^\p{Lu}\p{Lu}/u.test(word) ? word : word.charAt(0).toLowerCase() + word.slice(1));

const upperFirst = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

/** The word for one token in a language. */
export const levelWord = (labels: LevelLabels, token: string, locale: Locale): string => {
  const level: Level = token.toLowerCase().startsWith("class") ? "class" : "section";
  const name = labels[level];
  if (locale === "bn") return name.bn;
  const plural = token.toLowerCase() === "classes" || token.toLowerCase() === "sections";
  const word = plural ? name.en.other : name.en.one;
  return /^\p{Lu}/u.test(token) ? upperFirst(word) : lowerFirst(word);
};

type MessageTree = { [key: string]: string | MessageTree };

/** The messages with every level token replaced by the workspace's words. */
export const applyLevelLabels = <T extends MessageTree>(messages: T, labels: LevelLabels, locale: Locale): T => {
  const walk = (tree: MessageTree): MessageTree =>
    Object.fromEntries(
      Object.entries(tree).map(([key, value]) => [
        key,
        typeof value === "string" ? value.replace(LEVEL_TOKEN_PATTERN, (_, token: string) => levelWord(labels, token, locale)) : walk(value),
      ]),
    );
  return walk(messages) as T;
};

/** Reads the labels from a cookie value (server or browser). */
export const parseLevelLabelsCookie = (value: string | undefined | null): LevelLabels => {
  if (!value) return DEFAULT_LEVEL_LABELS;
  try {
    return toLevelLabels(JSON.parse(decodeURIComponent(value)));
  } catch {
    return DEFAULT_LEVEL_LABELS;
  }
};

/** The labels saved on this device (browser only). */
export const readLevelLabelsCookie = (): LevelLabels => {
  if (typeof document === "undefined") return DEFAULT_LEVEL_LABELS;
  const match = document.cookie.split("; ").find((part) => part.startsWith(`${LEVEL_LABELS_COOKIE}=`));
  return parseLevelLabelsCookie(match?.slice(LEVEL_LABELS_COOKIE.length + 1));
};

/**
 * Saves the workspace's labels on this device. Returns true when they changed, so the caller
 * refreshes the page to render them. Class / Section clears the cookie.
 */
export const writeLevelLabelsCookie = (labels: LevelLabels): boolean => {
  if (typeof document === "undefined" || sameLevelLabels(readLevelLabelsCookie(), labels)) return false;
  if (labels.preset === "CLASS_SECTION") {
    document.cookie = `${LEVEL_LABELS_COOKIE}=; path=/; max-age=0; samesite=lax`;
  } else {
    const value = encodeURIComponent(JSON.stringify(labels));
    document.cookie = `${LEVEL_LABELS_COOKIE}=${value}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
  }
  return true;
};
