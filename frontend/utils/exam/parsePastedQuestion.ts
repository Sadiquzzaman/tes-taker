/**
 * Rule-based (NON-AI) parser for pasted MCQ / short-answer content from Word,
 * Google Docs, websites, chatbots, PDFs (as text), etc.
 */

export type ParsedPastedQuestion = {
  question: string;
  options: string[];
  correctIndex: number | null;
  explanation: string;
};

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

const stripHtmlToText = (value: string): string =>
  value
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*p\s*>/gi, "\n")
    .replace(/<\/\s*div\s*>/gi, "\n")
    .replace(/<\/\s*li\s*>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

const cleanLine = (value: string): string =>
  value
    .replace(/^[\s:.\-–—*•]+/, "")
    .replace(/[\s:.\-–—]+$/, "")
    .replace(/\s+/g, " ")
    .trim();

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

const OPTION_LINE =
  /^(?:option\s*)?([a-h]|[1-8]|one|two|three|four|five|six|seven|eight)\s*[).:\-–—]\s*(.+)$/i;
const OPTION_LETTER_PAREN = /^\(([a-h]|[1-8])\)\s*(.+)$/i;
const CORRECT_LINE =
  /^(?:correct(?:\s+(?:option|answer))?|answer|ans)\s*[:\-]?\s*(?:option\s*)?([a-h]|[1-8]|one|two|three|four|five|six|seven|eight)?\s*(.*)$/i;
const EXPLANATION_LINE = /^(?:explanation|explain|solution|hint)\s*[:\-]?\s*(.*)$/i;

/**
 * Parse pasted plain text or lightly marked HTML into question fields.
 * Returns null-ish empty parse when nothing useful is detected.
 */
export const parsePastedQuestion = (raw: string): ParsedPastedQuestion => {
  const text = stripHtmlToText(raw ?? "");
  if (!text) {
    return { question: "", options: [], correctIndex: null, explanation: "" };
  }

  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const questionLines: string[] = [];
  const options: { label: string; text: string }[] = [];
  let correctIndex: number | null = null;
  let explanation = "";
  let mode: "question" | "options" | "explanation" = "question";

  for (const line of lines) {
    const explanationMatch = line.match(EXPLANATION_LINE);
    if (explanationMatch) {
      mode = "explanation";
      explanation = cleanLine(explanationMatch[1] || "");
      continue;
    }

    if (mode === "explanation") {
      explanation = explanation ? `${explanation} ${cleanLine(line)}` : cleanLine(line);
      continue;
    }

    const correctMatch = line.match(CORRECT_LINE);
    if (correctMatch) {
      const label = correctMatch[1];
      const rest = cleanLine(correctMatch[2] || "");
      if (label) {
        const idx = labelToIndex(label);
        if (idx !== null) {
          correctIndex = idx;
        }
      }
      if (rest && correctIndex === null) {
        const byValue = options.findIndex(
          (option) =>
            option.text.toLowerCase() === rest.toLowerCase() ||
            option.text.toLowerCase().includes(rest.toLowerCase()),
        );
        if (byValue >= 0) {
          correctIndex = byValue;
        }
      }
      continue;
    }

    const optionMatch = line.match(OPTION_LINE) || line.match(OPTION_LETTER_PAREN);
    if (optionMatch) {
      mode = "options";
      options.push({
        label: optionMatch[1].toLowerCase(),
        text: cleanLine(optionMatch[2]),
      });
      continue;
    }

    // Inline "Option A: text Option B: text" on one line
    const inlineOptionRegex =
      /\b(?:option\s*)?([a-h]|[1-8])\s*[).:\-–—]\s*/gi;
    const markers: { index: number; label: string; textStart: number }[] = [];
    let marker: RegExpExecArray | null;
    while ((marker = inlineOptionRegex.exec(line)) !== null) {
      markers.push({
        index: marker.index,
        label: marker[1].toLowerCase(),
        textStart: inlineOptionRegex.lastIndex,
      });
    }

    if (markers.length >= 2) {
      if (markers[0].index > 0) {
        questionLines.push(cleanLine(line.slice(0, markers[0].index)));
      }
      mode = "options";
      markers.forEach((item, index) => {
        const end = index + 1 < markers.length ? markers[index + 1].index : line.length;
        options.push({
          label: item.label,
          text: cleanLine(line.slice(item.textStart, end)),
        });
      });
      continue;
    }

    if (mode === "options" && options.length > 0) {
      // Continuation of last option
      const last = options[options.length - 1];
      last.text = cleanLine(`${last.text} ${line}`);
      continue;
    }

    questionLines.push(cleanLine(line));
  }

  // Trailing "correct option A" inside the last question line
  if (correctIndex === null && questionLines.length) {
    const joined = questionLines.join(" ");
    const trailing = joined.match(
      /\bcorrect(?:\s+(?:option|answer))?\s+([a-h]|[1-8]|one|two|three|four|five|six|seven|eight)\b/i,
    );
    if (trailing) {
      correctIndex = labelToIndex(trailing[1]);
      questionLines.splice(
        0,
        questionLines.length,
        ...questionLines
          .join(" ")
          .replace(/\bcorrect(?:\s+(?:option|answer))?\s+[a-h1-8]+\b/i, "")
          .split(/\n/)
          .map(cleanLine)
          .filter(Boolean),
      );
    }
  }

  const question = questionLines.filter(Boolean).join("\n").trim();
  const optionTexts = options.map((option) => option.text).filter(Boolean);

  // Resolve correct by label against collected options if label-based
  if (correctIndex !== null && correctIndex >= optionTexts.length) {
    correctIndex = null;
  }

  return {
    question,
    options: optionTexts,
    correctIndex,
    explanation,
  };
};

export const pastedLooksStructured = (parsed: ParsedPastedQuestion): boolean =>
  Boolean(parsed.question.trim() && (parsed.options.length >= 2 || parsed.explanation.trim()));
