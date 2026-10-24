import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import bn from "@/messages/bn.json";
import en from "@/messages/en.json";

type Tree = { [key: string]: string | Tree };

const flatten = (tree: Tree, prefix = ""): Record<string, string> =>
  Object.entries(tree).reduce<Record<string, string>>((all, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === "string" ? { ...all, [path]: value } : { ...all, ...flatten(value, path) };
  }, {});

const english = flatten(en);
const bangla = flatten(bn);

/** Argument names ({name}, {count, plural, …}) and rich-text tags (<b>…</b>) a message uses. */
const slots = (message: string) => {
  // Argument names start lower-case; this skips one-word select branches such as "{Password}".
  const args = [...message.matchAll(/\{\s*([a-z]\w*)\s*[,}]/g)].map((match) => match[1]);
  const tags = [...message.matchAll(/<(\w+)>/g)].map((match) => `<${match[1]}>`);
  return [...new Set([...args, ...tags])].sort();
};

// Placeholders that hold numbers. next-intl writes Bangla digits only for `{n, number}` or a plural's `#`;
// a plain `{n}` stays in Latin digits ("মোট নম্বর: 40").
const NUMBER_ARGS = new Set(["count", "seconds", "minutes", "marks", "points", "mark", "limit", "total", "current", "page", "size", "percent"]);
// Exceptions: the countdown gets already-formatted digits; the organisation number is an id people type.
const PLAIN_NUMBER_KEYS = new Set(["exam.countdown", "auth.signup.organizationNumber"]);

// Bangla messages that are meant to have no Bangla letters.
const LATIN_IN_BANGLA = new Set(["language.switchTo", "tests.category.ielts", "createTest.categories.ielts"]);

describe("messages", () => {
  it("has the same keys in Bangla and English", () => {
    expect(Object.keys(bangla).sort()).toEqual(Object.keys(english).sort());
  });

  it("has no empty messages", () => {
    for (const [key, value] of [...Object.entries(english), ...Object.entries(bangla)]) {
      expect(value.trim(), key).not.toBe("");
    }
  });

  it("uses the same placeholders and tags in both languages", () => {
    for (const key of Object.keys(english)) {
      expect(slots(bangla[key] ?? ""), key).toEqual(slots(english[key]));
    }
  });

  it("is actually translated into Bangla", () => {
    for (const [key, value] of Object.entries(bangla)) {
      if (!LATIN_IN_BANGLA.has(key)) {
        expect(value, key).toMatch(/[ঀ-৿]/);
      }
    }
  });

  it("does not use '.' in keys (next-intl reads it as nesting)", () => {
    const keysOf = (tree: Tree): string[] =>
      Object.entries(tree).flatMap(([key, value]) => (typeof value === "string" ? [key] : [key, ...keysOf(value)]));
    expect(keysOf(en).filter((key) => key.includes("."))).toEqual([]);
  });

  it("formats every number placeholder as a number, so Bangla gets Bangla digits", () => {
    for (const [key, message] of [...Object.entries(english), ...Object.entries(bangla)]) {
      if (PLAIN_NUMBER_KEYS.has(key)) continue;
      const plain = [...message.matchAll(/\{\s*([a-z]\w*)\s*\}/g)].map((match) => match[1]).filter((arg) => NUMBER_ARGS.has(arg));
      expect(plain, `${key} uses {${plain[0]}}; write {${plain[0]}, number}`).toEqual([]);
    }
  });

  it("shows exam numbers with Bangla digits", () => {
    const t = createTranslator({ locale: "bn", messages: bn });
    expect(t("exam.totalMarks", { marks: 40 })).toBe("মোট নম্বর: ৪০");
    expect(t("exam.wordCountLimit", { count: 120, limit: 250 })).toBe("শব্দসংখ্যা ১২০ / ২৫০");
    expect(t("exam.negativeMarking", { mark: 0.25 })).toBe("নেতিবাচক নম্বর: ০.২৫");
    expect(t("proctoring.currentFlagCount", { count: 3 })).toBe("বর্তমান ফ্ল্যাগ সংখ্যা: ৩");
    expect(t("exam.permissions.rules.limit", { count: 10 })).toBe("১০টি ফ্ল্যাগ পেলে পরীক্ষা বাতিল হয়ে যাবে।");
    // English keeps Latin digits.
    expect(createTranslator({ locale: "en", messages: en })("exam.totalMarks", { marks: 40 })).toBe("Total Marks: 40");
  });
});
