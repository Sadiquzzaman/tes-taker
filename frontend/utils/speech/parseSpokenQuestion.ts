/**
 * Rule-based (NON-AI) parser that turns a spoken sentence into a question, its options
 * and the correct option index.
 *
 * Supported phrasing (case-insensitive, punctuation optional):
 *   "What is the capital of Bangladesh? Option A: Dhaka, Option B: Khulna, correct option A"
 *
 * - Everything before the first "option <label>" marker becomes the question.
 * - Each "option <label> <text>" becomes an option.
 * - A trailing "correct [option|answer] <label|text>" selects the correct option.
 *
 * Labels can be letters (a-h), numbers (1-8) or number words (one..eight).
 * This is best-effort; the teacher can always review and edit afterwards.
 */

export interface ParsedSpokenQuestion {
  question: string;
  options: string[];
  correctIndex: number | null;
}

const NUMBER_WORDS: Record<string, number> = {
  one: 0,
  two: 1,
  three: 2,
  four: 3,
  five: 4,
  six: 5,
  seven: 6,
  eight: 7,
};

const LABEL_PATTERN = "[a-h]|[1-8]|one|two|three|four|five|six|seven|eight";

const labelToIndex = (rawLabel: string): number | null => {
  const label = rawLabel.trim().toLowerCase();
  if (/^[a-h]$/.test(label)) {
    return label.charCodeAt(0) - "a".charCodeAt(0);
  }
  if (/^[1-8]$/.test(label)) {
    return Number.parseInt(label, 10) - 1;
  }
  if (label in NUMBER_WORDS) {
    return NUMBER_WORDS[label];
  }
  return null;
};

const cleanText = (value: string): string =>
  value
    .replace(/^[\s:.,;-]+/, "")
    .replace(/[\s:.,;-]+$/, "")
    .replace(/\s+/g, " ")
    .trim();

const capitalizeFirst = (value: string): string =>
  value.length > 0 ? value.charAt(0).toUpperCase() + value.slice(1) : value;

export const parseSpokenQuestion = (transcript: string): ParsedSpokenQuestion => {
  const normalized = (transcript ?? "").replace(/\s+/g, " ").trim();

  if (!normalized) {
    return { question: "", options: [], correctIndex: null };
  }

  // 1) Split off a trailing "correct ..." clause (use the last occurrence).
  let working = normalized;
  let correctClause = "";
  const correctWordRegex = /\bcorrect\b/gi;
  let lastCorrectIndex = -1;
  let correctMatch: RegExpExecArray | null;
  while ((correctMatch = correctWordRegex.exec(normalized)) !== null) {
    lastCorrectIndex = correctMatch.index;
  }
  if (lastCorrectIndex >= 0) {
    correctClause = normalized.slice(lastCorrectIndex);
    working = normalized.slice(0, lastCorrectIndex).trim();
  }

  // 2) Find option markers in the remaining text.
  const optionMarkerRegex = new RegExp(`\\boption\\s+(${LABEL_PATTERN})\\b\\s*[:.,-]?\\s*`, "gi");
  const markers: { matchIndex: number; textStart: number; label: string }[] = [];
  let markerMatch: RegExpExecArray | null;
  while ((markerMatch = optionMarkerRegex.exec(working)) !== null) {
    markers.push({
      matchIndex: markerMatch.index,
      textStart: optionMarkerRegex.lastIndex,
      label: markerMatch[1].toLowerCase(),
    });
  }

  if (markers.length === 0) {
    // No options dictated — the whole transcript is the question.
    return { question: capitalizeFirst(cleanText(working || normalized)), options: [], correctIndex: null };
  }

  const question = capitalizeFirst(cleanText(working.slice(0, markers[0].matchIndex)));

  const parsedOptions = markers.map((marker, index) => {
    const textEnd = index + 1 < markers.length ? markers[index + 1].matchIndex : working.length;
    return {
      label: marker.label,
      text: capitalizeFirst(cleanText(working.slice(marker.textStart, textEnd))),
    };
  });

  // 3) Resolve the correct option from the trailing clause.
  let correctIndex: number | null = null;
  if (correctClause) {
    const clause = correctClause.replace(/^correct\b/i, "").trim();
    const labelRegex = new RegExp(`\\b(${LABEL_PATTERN})\\b`, "i");
    const labelHit = clause.match(labelRegex);

    if (labelHit) {
      const targetIndex = labelToIndex(labelHit[1]);
      if (targetIndex !== null) {
        const byLabel = parsedOptions.findIndex((option) => labelToIndex(option.label) === targetIndex);
        correctIndex = byLabel >= 0 ? byLabel : null;
      }
    }

    // Fallback: match the correct answer by its spoken value (e.g. "correct answer Dhaka").
    if (correctIndex === null) {
      const valueText = cleanText(clause.replace(/^(option|answer|answers|options|is|the)\s+/i, "")).toLowerCase();
      if (valueText) {
        const byValue = parsedOptions.findIndex(
          (option) =>
            option.text.toLowerCase() === valueText || option.text.toLowerCase().includes(valueText),
        );
        correctIndex = byValue >= 0 ? byValue : null;
      }
    }
  }

  return {
    question,
    options: parsedOptions.map((option) => option.text).filter((text) => text.length > 0),
    correctIndex,
  };
};
