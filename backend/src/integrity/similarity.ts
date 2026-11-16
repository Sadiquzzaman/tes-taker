/**
 * Text similarity for plagiarism checks (PLG-01): word shingles (5 words in a row) compared
 * between two texts. Works for Bangla and English: words are runs of letters, marks (Bangla
 * vowel signs) and digits, compared in lower case; punctuation and spacing do not matter.
 */

/** Words in a row that must match for a passage to count as shared. */
export const SHINGLE = 5;

export interface Word {
  text: string;
  start: number;
  end: number;
}

export interface Span {
  start: number;
  end: number;
}

export interface Comparison {
  /** Share of A's words inside passages also found in B, 0–100. */
  a_percent: number;
  b_percent: number;
  /** Matching passages, as character ranges in each text. */
  a_spans: Span[];
  b_spans: Span[];
}

export const words = (text: string): Word[] =>
  [...text.matchAll(/[\p{L}\p{M}\p{N}]+/gu)].map((m) => ({ text: m[0].toLocaleLowerCase(), start: m.index as number, end: (m.index as number) + m[0].length }));

const shingleKeys = (list: Word[]): string[] => {
  const keys: string[] = [];
  for (let i = 0; i + SHINGLE <= list.length; i += 1) keys.push(list.slice(i, i + SHINGLE).map((w) => w.text).join(' '));
  return keys;
};

/** Which words of `list` sit in a shingle that `other` also has. */
const covered = (list: Word[], keys: string[], other: Set<string>): boolean[] => {
  const hit = new Array<boolean>(list.length).fill(false);
  keys.forEach((key, i) => {
    if (!other.has(key)) return;
    for (let j = i; j < i + SHINGLE; j += 1) hit[j] = true;
  });
  return hit;
};

const spansOf = (list: Word[], hit: boolean[]): Span[] => {
  const spans: Span[] = [];
  hit.forEach((on, i) => {
    if (!on) return;
    const last = spans[spans.length - 1];
    if (last && hit[i - 1]) last.end = list[i].end;
    else spans.push({ start: list[i].start, end: list[i].end });
  });
  return spans;
};

const percent = (hit: boolean[]) => (hit.length ? Math.round((hit.filter(Boolean).length / hit.length) * 1000) / 10 : 0);

/** How much of each text is in passages shared with the other. */
export function compare(a: string, b: string): Comparison {
  const wa = words(a);
  const wb = words(b);
  const ka = shingleKeys(wa);
  const kb = shingleKeys(wb);
  const ha = covered(wa, ka, new Set(kb));
  const hb = covered(wb, kb, new Set(ka));
  return { a_percent: percent(ha), b_percent: percent(hb), a_spans: spansOf(wa, ha), b_spans: spansOf(wb, hb) };
}
