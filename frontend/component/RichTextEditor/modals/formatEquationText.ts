const SUBSCRIPT_DIGITS: Record<string, string> = {
  "0": "₀",
  "1": "₁",
  "2": "₂",
  "3": "₃",
  "4": "₄",
  "5": "₅",
  "6": "₆",
  "7": "₇",
  "8": "₈",
  "9": "₉",
};

const SUPERSCRIPT_DIGITS: Record<string, string> = {
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
  "+": "⁺",
  "-": "⁻",
};

const toSub = (digits: string) =>
  [...digits].map((char) => SUBSCRIPT_DIGITS[char] ?? char).join("");

const toSup = (chars: string) =>
  [...chars].map((char) => SUPERSCRIPT_DIGITS[char] ?? char).join("");

/**
 * Type normally — converts chemistry-friendly plain text into pretty Unicode.
 * Examples:
 *   2H2 + O2 -> 2H2O   →  2H₂ + O₂ → 2H₂O
 *   Fe3+               →  Fe³⁺
 *   a^2 + b^2 = c^2    →  a² + b² = c²
 */
export const formatEquationText = (raw: string): string => {
  let text = raw
    .replace(/<=>/g, "⇌")
    .replace(/<->/g, "↔")
    .replace(/->/g, "→")
    .replace(/<-/g, "←");

  // Ion charges: Fe3+, Ca2+, H+, e-
  text = text.replace(/([A-Za-z])(\d*)([+-])(?![A-Za-z])/g, (_match, element, digits, sign) => {
    return `${element}${toSup(`${digits}${sign}`)}`;
  });

  // Atom counts after element / closing paren: H2O, SO4, (NO3)2
  text = text.replace(/([A-Za-z\)\]])(\d+)/g, (_match, base, digits) => `${base}${toSub(digits)}`);

  // Explicit powers: a^2, x^-1
  text = text.replace(/\^(\d+)/g, (_match, digits) => toSup(digits));
  text = text.replace(/\^([+-])/g, (_match, sign) => toSup(sign));

  return text;
};
